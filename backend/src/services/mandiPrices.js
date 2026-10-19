// src/services/mandiPrices.js — live mandi prices from the Government of India Open Government
// Data platform: "Current Daily Price of Various Commodities from Various Markets (Mandi)"
// (Agmarknet data, resource 9ef84268-d588-465a-a308-a864a43d0070).
//
// Needs a free data.gov.in API key in DATA_GOV_IN_API_KEY. Without a key, or if the platform is
// unreachable, callers get an explicit status — prices are never estimated or filled in.
// The key is part of the request URL, so URLs are never logged or returned.

const RESOURCE_URL = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const TIMEOUT_MS = 10000;
const CACHE_MS = 30 * 60 * 1000; // the dataset is refreshed daily
const cache = new Map(); // state → { at, result }

export const MANDI_SOURCE = {
  title: 'data.gov.in — Current Daily Price of Various Commodities from Various Markets (Mandi), Agmarknet',
  url: 'https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi',
};

export const mandiConfigured = () => !!process.env.DATA_GOV_IN_API_KEY;

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh',
  'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
const STATE_ALIASES = { orissa: 'Odisha', pondicherry: 'Puducherry', 'nct of delhi': 'Delhi', uttaranchal: 'Uttarakhand' };

// The farm's state, read from its location text or its geocoded label ("Warangal, Telangana, India").
export function stateFromFarm(farm) {
  const texts = [farm?.location, farm?.coordinates?.label].filter(Boolean).map((t) => ` ${String(t).toLowerCase()} `);
  const names = [...INDIAN_STATES].sort((a, b) => b.length - a.length); // "Andhra Pradesh" before "Pradesh"-like overlaps
  for (const text of texts) {
    for (const name of names) if (text.includes(name.toLowerCase())) return { state: name, from: text.trim() };
    for (const [alias, name] of Object.entries(STATE_ALIASES)) if (text.includes(alias)) return { state: name, from: text.trim() };
  }
  return null;
}

// KisanAI crop names → keyword patterns for Agmarknet commodity names.
const COMMODITY_PATTERNS = {
  'paddy (rice)': /paddy|dhan/i,
  wheat: /^wheat/i,
  maize: /maize/i,
  cotton: /^cotton|kapas/i,
  soybean: /soya?\s?bean/i,
  onion: /^onion(?!.*green)/i,
  tomato: /^tomato/i,
  potato: /^potato/i,
  sugarcane: /sugar\s?cane/i,
  groundnut: /groundnut/i,
  mustard: /mustard/i,
  turmeric: /turmeric/i,
  banana: /^banana/i,
  mango: /^mango/i,
  'chickpea (chana)': /bengal gram|chana|^gram/i,
  'pigeonpea (tur)': /arhar|red gram|\btur\b/i,
  'jowar (sorghum)': /jowar|sorghum/i,
  'bajra (pearl millet)': /bajra|pearl millet/i,
  sunflower: /sunflower/i,
  jute: /^jute/i,
  'lentil (masoor)': /lentil|masur|masoor/i,
  'black gram (urad)': /black gram|urad/i,
  'mung bean (moong)': /green gram|moong/i,
  grapes: /^grapes?/i,
  pomegranate: /pomegranate/i,
  watermelon: /water\s?melon/i,
  muskmelon: /musk\s?melon/i,
  papaya: /^papaya/i,
  coconut: /coconut/i,
  orange: /^orange/i,
  apple: /^apple/i,
  coffee: /coffee/i,
};
export const commodityPattern = (cropName) => COMMODITY_PATTERNS[String(cropName || '').trim().toLowerCase()] || null;

const toNumber = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
function isoDate(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim()); // documented format dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : null;
}

// Field names as documented for this resource: state, district, market, commodity, variety, grade,
// arrival_date, min_price, max_price, modal_price (prices in ₹ per quintal).
function normalize(r) {
  const modal = toNumber(r.modal_price);
  if (modal === null || !r.commodity) return null;
  return {
    state: r.state || null, district: r.district || null, market: r.market || null,
    commodity: r.commodity, variety: r.variety || null, grade: r.grade || null,
    arrivalDate: isoDate(r.arrival_date),
    minPrice: toNumber(r.min_price), maxPrice: toNumber(r.max_price), modalPrice: modal,
    unit: '₹/quintal',
  };
}

// All of today's records for a state (one request, cached for 30 minutes).
export async function fetchStatePrices(state) {
  if (!mandiConfigured()) {
    return { status: 'not_configured', records: [], message: 'Live mandi prices are not configured — set DATA_GOV_IN_API_KEY (a free key from data.gov.in) in backend/.env.' };
  }
  const hit = cache.get(state);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.result;

  const params = new URLSearchParams({
    'api-key': process.env.DATA_GOV_IN_API_KEY, format: 'json', limit: '2000', 'filters[state.keyword]': state,
  });
  const base = process.env.DATA_GOV_IN_BASE_URL || RESOURCE_URL; // override only for local contract tests
  let res;
  try {
    res = await fetch(`${base}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    return { status: 'unavailable', records: [], message: `data.gov.in could not be reached (${e.name === 'TimeoutError' ? 'timed out' : 'network error'}).` };
  }
  if (!res.ok) {
    return { status: 'unavailable', records: [], message: `data.gov.in returned HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' — check DATA_GOV_IN_API_KEY' : ''}.` };
  }
  let body;
  try { body = await res.json(); } catch { return { status: 'unavailable', records: [], message: 'data.gov.in returned a response that is not JSON.' }; }
  const records = (Array.isArray(body.records) ? body.records : []).map(normalize).filter(Boolean);
  const result = { status: 'ok', records, total: toNumber(body.total), updated: body.updated_date || null, fetchedAt: new Date().toISOString() };
  cache.set(state, { at: Date.now(), result });
  return result;
}
