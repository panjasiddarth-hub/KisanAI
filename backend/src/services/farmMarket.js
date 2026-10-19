// src/services/farmMarket.js — mandi prices for a farm's crops (the crop the farmer selected plus
// the latest recommendation's shortlist).
//
// • Live prices: today's Agmarknet records for the farm's state (data.gov.in), when configured.
// • Price model: whether the XGBoost price model covers the crop at all. It is NOT run here —
//   it needs the last three real prices at one of the mandis it was trained on, and KisanAI has
//   no price history yet. Nothing is estimated in its place.

import { recommendations } from '../database/repositories/store.js';
import { commodityPattern, fetchStatePrices, MANDI_SOURCE, stateFromFarm } from './mandiPrices.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const norm = (s) => String(s || '').trim().toLowerCase();

// KisanAI crop names → commodity names in the price model's vocabulary (verified at runtime
// against the model artifact via the ML service's /meta/market).
const MODEL_COMMODITY = {
  'paddy (rice)': 'Paddy(Dhan)', wheat: 'Wheat', maize: 'Maize', cotton: 'Cotton', soybean: 'Soybean',
  onion: 'Onion', tomato: 'Tomato', potato: 'Potato', sugarcane: 'Sugarcane', groundnut: 'Groundnut',
  mustard: 'Mustard', turmeric: 'Turmeric', banana: 'Banana', mango: 'Mango',
  'chickpea (chana)': 'Gram(Chana)', 'jowar (sorghum)': 'Jowar', 'bajra (pearl millet)': 'Bajra',
};

async function priceModelVocabulary() {
  try {
    const res = await fetch(`${ML_SERVICE_URL}/meta/market`, { signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function farmCrops(farm, latestRec) {
  const list = [];
  const add = (name, source) => {
    if (!name) return;
    const existing = list.find((c) => norm(c.name) === norm(name));
    if (existing) { if (!existing.sources.includes(source)) existing.sources.push(source); }
    else list.push({ name, sources: [source] });
  };
  const sel = farm.selectedCrop;
  if (sel?.crop) add(sel.calendarCrop || sel.displayName || sel.crop, 'selected');
  for (const item of latestRec?.shortlist || []) add(item.calendarCrop || item.displayName || item.crop, 'recommended');
  return list;
}

// latestRecommendation: optional explicit recommendation (plot-level callers pass the plot's own,
// or null). Omitted → the farm's latest recommendation, as before.
export async function marketForFarm({ userId, farm, latestRecommendation }) {
  const [latest] = latestRecommendation !== undefined ? [latestRecommendation].filter(Boolean) : await recommendations.listForFarm(userId, farm.id, 1);
  const crops = farmCrops(farm, latest);
  const place = stateFromFarm(farm);
  const missing = [];
  const limitations = [];

  if (!crops.length) {
    missing.push({ field: 'crops', label: 'Crops to price', fix: 'Get a crop recommendation for this farm, or select a crop, on the Farms page' });
  }
  if (!place) {
    missing.push({ field: 'state', label: 'State', fix: "Include the state in the farm's location (e.g. \"Warangal, Telangana\") or pick the location from search" });
  }

  const [vocab, live] = await Promise.all([
    priceModelVocabulary(),
    place && crops.length ? fetchStatePrices(place.state) : Promise.resolve(null),
  ]);
  const district = norm(String(farm.location || '').split(',')[0]);
  const isLocal = (r) => !!district && (norm(r.district).includes(district) || norm(r.market).includes(district));

  const items = crops.map((c) => {
    const modelCommodity = MODEL_COMMODITY[norm(c.name)] || null;
    const supported = vocab ? !!(modelCommodity && vocab.Commodity?.includes(modelCommodity)) : null;
    const model = {
      supported,
      commodity: supported ? modelCommodity : null,
      forecast: null,
      note: supported === null
        ? "Couldn't check price-model coverage (ML service unavailable)."
        : supported
          ? `The price model covers ${modelCommodity}, but a forecast needs the last three real prices at one of the ${vocab.Market?.length ?? ''} mandis it was trained on. KisanAI doesn't store mandi price history yet, so no forecast is shown.`
          : `No price model for this crop — the model covers ${vocab.Commodity?.length ?? 'a few'} commodities only.`,
    };

    let livePart;
    const pattern = commodityPattern(c.name);
    if (!live) livePart = { status: 'skipped', message: place ? 'No crops to look up.' : "The farm's state is unknown." };
    else if (live.status !== 'ok') livePart = { status: live.status, message: live.message };
    else if (!pattern) livePart = { status: 'no_mapping', message: `KisanAI doesn't know the Agmarknet commodity name for ${c.name}.` };
    else {
      const recs = live.records.filter((r) => pattern.test(r.commodity));
      if (!recs.length) {
        livePart = { status: 'no_records', message: `No ${c.name} prices reported from ${place.state} mandis in the latest data.` };
      } else {
        const sorted = [...recs].sort((a, b) =>
          (isLocal(b) - isLocal(a)) || String(b.arrivalDate || '').localeCompare(String(a.arrivalDate || '')) || b.modalPrice - a.modalPrice);
        const modals = recs.map((r) => r.modalPrice);
        livePart = {
          status: 'ok',
          markets: recs.length,
          latestArrivalDate: recs.map((r) => r.arrivalDate).filter(Boolean).sort().pop() || null,
          modalMin: Math.min(...modals), modalMax: Math.max(...modals), unit: '₹/quintal',
          records: sorted.slice(0, 5).map((r) => ({ ...r, nearFarm: isLocal(r) })),
        };
      }
    }
    return { crop: c.name, sources: c.sources, model, live: livePart };
  });

  if (live && live.status !== 'ok') limitations.push(live.message);
  limitations.push("Live prices are the day's wholesale minimum / maximum / modal prices reported by mandis to Agmarknet — not a forecast and not a farm-gate price.");
  limitations.push('Commodity names are matched by keyword, so check the commodity and variety shown on each row.');

  return {
    status: !crops.length ? 'insufficient_data' : live?.status === 'ok' ? 'ok' : 'partial',
    farm: { id: farm.id, name: farm.name, location: farm.location || null },
    state: place?.state || null,
    recommendationId: latest?.id || null,
    live: live
      ? { status: live.status, message: live.message || null, updated: live.updated || null, fetchedAt: live.fetchedAt || null }
      : { status: 'skipped', message: !crops.length ? 'No crops to look up.' : "The farm's state is unknown." },
    crops: items,
    priceModel: vocab ? { commodities: vocab.Commodity, markets: vocab.Market } : null,
    missing,
    limitations,
    sources: [MANDI_SOURCE],
  };
}
