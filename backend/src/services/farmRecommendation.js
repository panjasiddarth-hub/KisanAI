// src/services/farmRecommendation.js — farm-specific crop recommendation.
//
// farm profile + saved soil test + historical season climate at the farm's CONFIRMED coordinates
//   → crop model (ML service /predict/crop, real class probabilities)
//   → knowledge-base feasibility checks (season, soil, pH, water, crop history)
//   → top three.
// If the model can't be used, the existing rule engine is used as a clearly labelled fallback.
// If neither has enough data, nothing is ranked and the missing information is listed instead.
// No default location, default soil values, invented scores or invented costs are ever used.

import { CROPS } from '../data/crops.js';
import { rankAllCrops } from '../agents/cropAgent.js';
import { fetchSeasonClimate } from './openMeteo.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const CLIMATE_DAYS = 120;
const CLIMATE_YEARS = 5;

// Same season rule the calendar has always used (shared so both agree).
export function seasonOf(dateStr) {
  const m = new Date(dateStr).getMonth() + 1;
  if (m >= 6 && m <= 10) return 'kharif';
  if (m >= 11 || m <= 3) return 'rabi';
  return 'zaid';
}

// Farm form vocabulary → rule-engine / knowledge-base vocabulary (also used by the fertilizer plan).
export const SOIL_MAP = {
  'black cotton': 'black', black: 'black', 'red laterite': 'red', red: 'red', laterite: 'laterite',
  alluvial: 'alluvial', sandy: 'sandy', clay: 'clay', loamy: 'loamy',
};
const WATER_MAP = {
  borewell: 'irrigated', canal: 'irrigated', river: 'irrigated', 'drip irrigation': 'irrigated', pond: 'irrigated',
  'rain-fed': 'rainfed', rainfed: 'rainfed',
};

// The crop model's 22 classes. Only six exist in the KisanAI knowledge base (kb).
const ML_CROPS = {
  rice: { display: 'Paddy (Rice)', kb: 'Paddy (Rice)' },
  maize: { display: 'Maize', kb: 'Maize' },
  chickpea: { display: 'Chickpea (Chana)', kb: 'Chickpea (Chana)' },
  pigeonpeas: { display: 'Pigeonpea (Tur)', kb: 'Pigeonpea (Tur)' },
  cotton: { display: 'Cotton', kb: 'Cotton' },
  banana: { display: 'Banana', kb: 'Banana' },
  kidneybeans: { display: 'Kidney beans (Rajma)' }, mothbeans: { display: 'Moth beans' },
  mungbean: { display: 'Mung bean (Moong)' }, blackgram: { display: 'Black gram (Urad)' },
  lentil: { display: 'Lentil (Masoor)' }, pomegranate: { display: 'Pomegranate' }, mango: { display: 'Mango' },
  grapes: { display: 'Grapes' }, watermelon: { display: 'Watermelon' }, muskmelon: { display: 'Muskmelon' },
  apple: { display: 'Apple' }, orange: { display: 'Orange' }, papaya: { display: 'Papaya' },
  coconut: { display: 'Coconut' }, jute: { display: 'Jute' }, coffee: { display: 'Coffee' },
};

const FEATURE_LABELS = {
  N: 'Soil N', P: 'Soil P', K: 'Soil K', ph: 'Soil pH',
  temperature: 'Season temperature (°C)', humidity: 'Season humidity (%)', rainfall: 'Season rainfall (mm per 30 days)',
};
const COST_NOTE = 'Not available — the KisanAI knowledge base has no cost data yet';

const norm = (s) => String(s || '').trim().toLowerCase();
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const pct = (p) => (p >= 0.01 ? `${Math.round(p * 100)}%` : '<1%');
const words = (s) => new Set(norm(s).match(/[a-z]+/g) || []);
const sameCrop = (a, b) => [...words(a)].some((w) => w.length > 2 && words(b).has(w));

function kbChecks(meta, ctx) {
  const reasons = [];
  const limitations = [];
  let exclude = null;

  if (meta.seasons.includes(ctx.season)) reasons.push(`${cap(ctx.season)} crop — matches your planned sowing date`);
  else exclude = `Grown in ${meta.seasons.map(cap).join('/')}, but your planned sowing date falls in ${cap(ctx.season)}`;

  if (!ctx.soil) limitations.push('Soil-type fit not checked — the farm has no recognised soil type');
  else if (meta.soils.includes(ctx.soil)) reasons.push(`Suited to ${ctx.soil} soil`);
  else limitations.push(`Not listed as suited to ${ctx.soil} soil`);

  if (ctx.ph == null) limitations.push('pH fit not checked — no soil pH saved');
  else {
    const [lo, hi] = meta.ph;
    if (ctx.ph >= lo && ctx.ph <= hi) reasons.push(`Soil pH ${ctx.ph} is within its range (${lo}–${hi})`);
    else limitations.push(`Soil pH ${ctx.ph} is outside its range (${lo}–${hi})`);
  }

  if (!ctx.irrigation) limitations.push('Water fit not checked — the farm has no recognised water source');
  else if (meta.water === 'high' && ctx.irrigation === 'rainfed') exclude = exclude || 'Needs assured irrigation, but this farm is rain-fed';
  else if (meta.water === 'medium' && ctx.irrigation === 'rainfed') limitations.push('Moderate water need — risky on a rain-fed farm');
  else if (ctx.irrigation === 'irrigated') reasons.push(`${cap(meta.water)} water need — farm is irrigated (${ctx.waterSource})`);
  else reasons.push('Low water need — suits rain-fed conditions');

  const grown = ctx.history.find((h) => sameCrop(h, meta.name));
  if (grown) limitations.push(`Already in this farm's crop history (${grown}) — check rotation`);

  return { reasons, limitations, exclude };
}

function baseItem({ crop, displayName, meta, score }) {
  return {
    crop,
    displayName,
    calendarCrop: meta?.name || displayName,
    inKnowledgeBase: !!meta,
    score,
    reasons: [],
    limitations: [],
    durationDays: meta?.duration || null,
    waterNeed: meta?.water || null,
    note: meta?.hint || null,
    estimatedCost: null,
    costNote: COST_NOTE,
  };
}

function shortlistFromModel(modelRecs, ctx) {
  const shortlist = [];
  const excluded = [];
  for (const { crop, score } of modelRecs) {
    if (!(score > 0)) continue; // zero model probability → not a candidate
    const info = ML_CROPS[crop] || { display: crop };
    const meta = info.kb ? CROPS.find((c) => c.name === info.kb) : null;
    const item = baseItem({
      crop, displayName: info.display, meta,
      score: { kind: 'ml-probability', value: score, label: `${pct(score)} model probability` },
    });
    item.reasons.push(`Crop model gives it ${pct(score)} probability for this soil test and season climate`);
    if (meta) {
      const chk = kbChecks(meta, ctx);
      if (chk.exclude) { excluded.push({ crop, displayName: info.display, score: item.score, reason: chk.exclude }); continue; }
      item.reasons.push(...chk.reasons);
      item.limitations.push(...chk.limitations);
    } else {
      item.limitations.push(
        'Not in the KisanAI knowledge base — season, soil, pH and water fit were not checked',
        'The calendar will use a generic 90–120-day template for this crop',
      );
      const grown = ctx.history.find((h) => sameCrop(h, info.display) || sameCrop(h, crop));
      if (grown) item.limitations.push(`Already in this farm's crop history (${grown}) — check rotation`);
    }
    shortlist.push(item);
    if (shortlist.length === 3) break;
  }
  return { shortlist, excluded };
}

function shortlistFromRules(ruleRecs, ctx) {
  const shortlist = [];
  const excluded = [];
  for (const r of ruleRecs) {
    const meta = CROPS.find((c) => c.name === r.crop);
    const chk = kbChecks(meta, ctx);
    const score = { kind: 'rule-suitability', value: r.score, label: `${r.score}% knowledge-base match` };
    if (chk.exclude) { excluded.push({ crop: r.crop, displayName: r.crop, score, reason: chk.exclude }); continue; }
    if (r.score <= 0) continue;
    const item = baseItem({ crop: r.crop, displayName: r.crop, meta, score });
    item.reasons.push(...chk.reasons);
    item.limitations.push(...chk.limitations);
    shortlist.push(item);
    if (shortlist.length === 3) break;
  }
  return { shortlist, excluded };
}

async function callCropModel(features) {
  let res;
  try {
    res = await fetch(`${ML_SERVICE_URL}/predict/crop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...features, top_k: 22 }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'ML service timed out' : 'ML service unreachable');
  }
  if (!res.ok) throw new Error(`ML service returned HTTP ${res.status}`);
  return res.json();
}

export async function recommendCropsForFarm({ farm, cropHistory = [], plannedSowingDate }) {
  const season = seasonOf(plannedSowingDate);
  const missing = [];
  const limitations = [];
  const inputs = {
    plannedSowingDate,
    season,
    seasonRule: 'Derived from the planned sowing month: Jun–Oct kharif, Nov–Mar rabi, Apr–May zaid',
    cropHistory,
  };

  // --- Farm profile (soil type, water) ---
  const soil = SOIL_MAP[norm(farm.soilType)] || null;
  inputs.soilType = farm.soilType ? { value: farm.soilType, usedAs: soil, source: 'Farm profile' } : null;
  if (!soil) missing.push({
    field: 'soilType', label: 'Soil type',
    reason: farm.soilType ? `“${farm.soilType}” is not a soil type the knowledge base recognises` : 'Not set on this farm',
    fix: 'Edit the farm and choose a soil type',
  });
  const irrigation = WATER_MAP[norm(farm.waterSource)] || null;
  inputs.waterSource = farm.waterSource ? { value: farm.waterSource, usedAs: irrigation, source: 'Farm profile' } : null;
  if (!irrigation) missing.push({
    field: 'waterSource', label: 'Water source',
    reason: farm.waterSource ? `“${farm.waterSource}” is not a recognised water source` : 'Not set on this farm',
    fix: 'Edit the farm and choose a water source',
  });

  // --- Soil test (no defaults) ---
  const st = farm.soilTest || {};
  const soilValues = {};
  for (const k of ['N', 'P', 'K', 'ph']) {
    if (Number.isFinite(st[k])) soilValues[k] = st[k];
    else missing.push({
      field: `soilTest.${k}`, label: FEATURE_LABELS[k], reason: 'No soil test value saved for this farm',
      fix: 'Edit the farm → Soil test, and enter it from your Soil Health Card',
    });
  }
  inputs.soilTest = Object.keys(soilValues).length
    ? { ...soilValues, testedOn: st.testedOn || null, source: 'Farm soil test (entered by the farmer)' }
    : null;

  // --- Season climate at the farm's confirmed coordinates (never a default location) ---
  const c = farm.coordinates;
  const confirmed = c && Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.confirmedAt;
  let climate = null;
  if (!confirmed) {
    missing.push({
      field: 'coordinates', label: 'Confirmed farm location',
      reason: c && Number.isFinite(c.lat) ? 'Coordinates are saved but not confirmed' : 'No coordinates saved for this farm',
      fix: 'Edit the farm → Farm location: use your device location, search for a place or enter latitude/longitude, then confirm',
    });
  } else {
    try {
      climate = await fetchSeasonClimate(c.lat, c.lon, plannedSowingDate, { days: CLIMATE_DAYS, years: CLIMATE_YEARS });
      inputs.climate = { ...climate, farmCoordinates: { lat: c.lat, lon: c.lon }, locationSource: c.source || null, locationLabel: c.label || null };
    } catch (e) {
      missing.push({ field: 'climate', label: 'Season climate', reason: `Historical weather could not be loaded (${e.message})`, fix: 'Try again in a few minutes' });
    }
  }

  const ctx = {
    season, soil, irrigation, waterSource: farm.waterSource, ph: soilValues.ph ?? null,
    history: cropHistory,
  };

  // --- 1. Crop model (ML) ---
  let engine = 'none';
  let shortlist = [];
  let excluded = [];
  let model = null;
  const mlReady = ['N', 'P', 'K', 'ph'].every((k) => soilValues[k] != null) && climate;
  if (mlReady) {
    const features = {
      N: soilValues.N, P: soilValues.P, K: soilValues.K,
      temperature: climate.temperature, humidity: climate.humidity, ph: soilValues.ph, rainfall: climate.rainfall,
    };
    model = { name: 'crop_random_forest', endpoint: '/predict/crop', features, used: false };
    try {
      const ml = await callCropModel(features);
      model.outOfRange = ml.out_of_range || [];
      if (model.outOfRange.length) {
        limitations.push(...model.outOfRange.map((o) =>
          `Crop model not used: ${FEATURE_LABELS[o.feature] || o.feature} = ${o.value} is outside the range the model was trained on (${o.model_min}–${o.model_max})`));
      } else {
        engine = 'ml';
        model.used = true;
        model.topPrediction = ml.prediction;
        ({ shortlist, excluded } = shortlistFromModel(ml.recommendations || [], ctx));
      }
    } catch (e) {
      model.error = e.message;
      limitations.push(`Crop model unavailable (${e.message})`);
    }
  }

  // --- 2. Rule-engine fallback (needs soil type, water source and pH — never defaulted) ---
  if (engine !== 'ml' && soil && irrigation && ctx.ph != null && ctx.ph >= 4 && ctx.ph <= 9.5) {
    const ranked = rankAllCrops({ soilType: soil, ph: ctx.ph, season, irrigation });
    if (!ranked.error) {
      engine = 'rule-engine';
      ({ shortlist, excluded } = shortlistFromRules(ranked.recommendations, ctx));
    }
  }

  // --- Status + honest caveats ---
  const status = engine === 'ml' ? (missing.length ? 'partial' : 'ok') : engine === 'rule-engine' ? 'partial' : 'insufficient_data';
  if (engine === 'ml') {
    limitations.push(
      'Scores are the crop model’s class probabilities (random forest trained on a public crop dataset) — not yield or profit predictions',
      `Climate inputs are ${CLIMATE_YEARS}-year historical averages (ERA5 reanalysis) for the ${CLIMATE_DAYS} days from your planned sowing date; rainfall is expressed per 30 days because the model’s rainfall unit is not documented`,
      'N, P and K are passed to the model as entered; the model’s nutrient units are not documented in the project',
    );
    if (shortlist.length < 3) limitations.push(`Only ${shortlist.length} crop(s) had a non-zero model probability and passed the season and water checks`);
  }
  if (engine === 'rule-engine') {
    limitations.push(
      'The crop model could not be used, so these come from the KisanAI rule engine; its score is a knowledge-base match (soil, pH, season, water), not a model probability',
    );
    if (shortlist.length < 3) limitations.push(`Only ${shortlist.length} knowledge-base crop(s) passed the season and water checks`);
  }
  if (engine !== 'none') limitations.push('Cost estimates are not shown: the knowledge base has no cost data yet');
  if (engine === 'none') {
    limitations.push('Not enough information to rank crops reliably — add the missing details below and try again');
  }

  return { status, engine, plannedSowingDate, season, inputs, model, shortlist, excluded, missing, limitations };
}
