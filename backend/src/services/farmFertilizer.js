// src/services/farmFertilizer.js — fertilizer plan for a saved farm.
//
// crop (the farm's selected crop, or one the farmer picks) + farm area + soil type + the farm's
// Soil Health Card values
//   → nutrient ratings by the official ICAR-IISS Soil Health Card limits
//   → the ML soil-rating model's assessment shown alongside (never silently substituted)
//   → KisanAI's per-crop recommended dose, adjusted by the N / P / K ratings
//   → products, totals for the farm's area and split dates that match the farm's calendar.
//
// Nothing is invented: missing soil values are listed, crops without a crop-specific dose are
// flagged, and no micronutrient doses are prescribed.

import { CROPS } from '../data/crops.js';
import { cropRule, fertilizePlan, hasCropSpecificRule } from '../agents/fertilizerAgent.js';
import { seasonOf, SOIL_MAP } from './farmRecommendation.js';
import { activePlanForFarm, addDays, farmAreaAcres } from './farmContext.js';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const ML_TIMEOUT_MS = 10000;
const norm = (s) => String(s || '').trim().toLowerCase();
const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export const SOURCES = {
  shc: {
    title: 'ICAR-IISS — Soil Health Card parameters and their critical limits (Table 1)',
    url: 'https://iiss.res.in/old/eMagazine/v4i1/12.pdf',
  },
  adjustment: {
    title: 'Soil-test based dose: Low → 25% more than the crop dose, Medium → the crop dose, High → 25% less (Current World Environment 16(3))',
    url: 'https://www.cwejournal.org/vol16no3/soil-nutrient-evaluation-and-crop-management-for-sustainable-growth-of-patiyavillage-cluster-in-almora--uttarakhand',
  },
  doses: { title: 'KisanAI fertilizer rule engine — per-crop recommended doses (backend/src/agents/fertilizerAgent.js)' },
};

// ICAR-IISS Soil Health Card limits. Three-class nutrients: below `low` = Low, above `high` = High.
const RATED = {
  N: { label: 'Available nitrogen (N)', unit: 'kg/ha', low: 280, high: 560 },
  P: { label: 'Available phosphorus (P)', unit: 'kg/ha', low: 10, high: 25 },
  K: { label: 'Available potassium (K)', unit: 'kg/ha', low: 120, high: 280 },
  oc: { label: 'Organic carbon (OC)', unit: '%', low: 0.5, high: 0.75 },
};
// Deficient below the critical limit.
const CRITICAL = {
  s: { label: 'Sulphur (S)', unit: 'ppm', limit: 10, model: 'S' },
  zn: { label: 'Zinc (Zn)', unit: 'ppm', limit: 0.6, model: 'Zn' },
  fe: { label: 'Iron (Fe)', unit: 'ppm', limit: 4.5, model: 'Fe' },
  cu: { label: 'Copper (Cu)', unit: 'ppm', limit: 0.2, model: 'Cu' },
  mn: { label: 'Manganese (Mn)', unit: 'ppm', limit: 2.0, model: 'Mn' },
  b: { label: 'Boron (B)', unit: 'ppm', limit: 0.5, model: 'B' },
};
const DOSE_FACTOR = { Low: 1.25, Medium: 1, High: 0.75 };

// Every Soil Health Card value the ML rating model needs (farm soilTest key → model feature).
const MODEL_FEATURES = {
  ph: 'pH', ec: 'EC_dS_per_m', oc: 'OC_percent', N: 'N_kg_per_ha', P: 'P_kg_per_ha', K: 'K_kg_per_ha',
  s: 'S_ppm', zn: 'Zn_ppm', b: 'B_ppm', fe: 'Fe_ppm', cu: 'Cu_ppm', mn: 'Mn_ppm',
};
const FEATURE_LABEL = {
  pH: 'pH', EC_dS_per_m: 'EC (dS/m)', OC_percent: 'Organic carbon (%)', N_kg_per_ha: 'N (kg/ha)',
  P_kg_per_ha: 'P (kg/ha)', K_kg_per_ha: 'K (kg/ha)', S_ppm: 'S (ppm)', Zn_ppm: 'Zn (ppm)',
  B_ppm: 'B (ppm)', Fe_ppm: 'Fe (ppm)', Cu_ppm: 'Cu (ppm)', Mn_ppm: 'Mn (ppm)',
};
export const SOIL_TEST_LABELS = {
  N: 'N', P: 'P', K: 'K', ph: 'pH', ec: 'EC', oc: 'Organic carbon', s: 'S', zn: 'Zn', b: 'B', fe: 'Fe', cu: 'Cu', mn: 'Mn',
};

// Farm soil types → the rating model's soil classes. Where there is no exact class, every
// plausible class is tried and a rating is only reported if they all agree.
const MODEL_SOIL = {
  'black cotton': { classes: ['Black (Regur)'] },
  black: { classes: ['Black (Regur)'] },
  alluvial: { classes: ['Alluvial'] },
  red: { classes: ['Red'] },
  laterite: { classes: ['Laterite'] },
  'red laterite': { classes: ['Red', 'Laterite'], note: 'The model has separate Red and Laterite classes, so both were tried.' },
  sandy: { classes: ['Sandy Loam'], note: 'The model has no plain Sandy class; its closest class, Sandy Loam, was used.' },
  clay: { classes: ['Clay Loam'], note: 'The model has no plain Clay class; its closest class, Clay Loam, was used.' },
  loamy: { classes: ['Clay Loam', 'Sandy Loam'], note: 'The model has no plain Loamy class, so Clay Loam and Sandy Loam were both tried.' },
};

const rate3 = (v, { low, high }) => (v < low ? 'Low' : v > high ? 'High' : 'Medium');

async function callRatingModel(payload) {
  const res = await fetch(`${ML_SERVICE_URL}/predict/fertilizer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(ML_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ML service returned HTTP ${res.status}`);
  return res.json();
}

// Runs the ML soil-rating model when every input it needs is available.
async function modelAssessment(st, farmSoilType, season) {
  const soil = MODEL_SOIL[norm(farmSoilType)];
  const base = { used: false, name: 'fertilizer_multioutput_classifier', season: season.model, ratings: {} };
  const missing = Object.keys(MODEL_FEATURES).filter((k) => num(st?.[k]) === null);
  if (missing.length) {
    return { ...base, reason: `Needs all 12 Soil Health Card values — missing: ${missing.map((k) => SOIL_TEST_LABELS[k]).join(', ')}` };
  }
  if (!soil) return { ...base, reason: farmSoilType ? `Soil type "${farmSoilType}" has no matching class in the model` : 'Soil type not set on the farm' };

  const features = Object.fromEntries(Object.entries(MODEL_FEATURES).map(([k, f]) => [f, num(st[k])]));
  let results;
  try {
    results = await Promise.all(soil.classes.map((cls) => callRatingModel({ ...features, Soil_Type: cls, Season: season.model })));
  } catch (e) {
    return { ...base, soilClasses: soil.classes, reason: `ML service unavailable (${e.name === 'TimeoutError' ? 'timed out' : e.message})` };
  }
  const outOfRange = results[0].out_of_range || [];
  const unknown = results.flatMap((r) => r.unknown_categories || []);
  if (outOfRange.length || unknown.length) {
    return {
      ...base, soilClasses: soil.classes, soilNote: soil.note,
      outOfRange: outOfRange.map((o) => ({ ...o, label: FEATURE_LABEL[o.feature] || o.feature })),
      reason: outOfRange.length
        ? `Some values are outside the range the model was trained on: ${outOfRange.map((o) => `${FEATURE_LABEL[o.feature] || o.feature} ${o.value} (model range ${o.model_min}–${o.model_max})`).join('; ')}`
        : `Model doesn't recognise: ${unknown.map((u) => `${u.feature} "${u.value}"`).join(', ')}`,
    };
  }
  const ratings = {};
  for (const nutrient of Object.keys(results[0].ratings)) {
    const perClass = results.map((r) => r.ratings[nutrient]);
    if (perClass.every((x) => x === perClass[0])) {
      ratings[nutrient] = { rating: perClass[0], confidence: Math.min(...results.map((r) => r.confidence?.[nutrient] ?? 0)) };
    } else {
      ratings[nutrient] = {
        rating: null,
        dependsOnSoilClass: Object.fromEntries(soil.classes.map((cls, i) => [cls, perClass[i]])),
      };
    }
  }
  return { ...base, used: true, soilClasses: soil.classes, soilNote: soil.note, ratings, modelSource: results[0].modelSource };
}

function resolveCrop(farm, requested) {
  if (requested) {
    const kb = CROPS.find((c) => norm(c.name) === norm(requested));
    if (!kb) return { error: `Unknown crop "${requested}". Choose one of: ${CROPS.map((c) => c.name).join(', ')}` };
    return { name: kb.name, source: 'chosen' };
  }
  const sel = farm.selectedCrop;
  if (sel?.crop) return { name: sel.calendarCrop || sel.displayName || sel.crop, source: 'selected', inKnowledgeBase: !!sel.calendarCrop };
  return null;
}

// plan: optional explicit calendar (plot-level callers pass the plot's own plan or null, so a
// farm-level calendar is never used for a plot). Omitted → the farm's active plan, as before.
export async function fertilizerPlanForFarm({ userId, farm, crop: requestedCrop, plan: planOverride }) {
  const missing = [];
  const limitations = [];
  const crop = resolveCrop(farm, requestedCrop);
  if (crop?.error) return { error: crop.error, status: 400 };

  const acres = farmAreaAcres(farm);
  const plan = planOverride !== undefined ? planOverride : await activePlanForFarm(userId, farm);
  const planForCrop = crop && plan && norm(plan.crop) === norm(crop.name) ? plan : null;
  const sowingDate = planForCrop?.sowingDate
    || (crop && farm.selectedCrop?.sowingDate && norm(farm.selectedCrop.calendarCrop || farm.selectedCrop.displayName) === norm(crop.name) ? farm.selectedCrop.sowingDate : null);
  const seasonKey = seasonOf(sowingDate || new Date().toISOString().slice(0, 10));
  const season = {
    name: seasonKey,
    model: seasonKey[0].toUpperCase() + seasonKey.slice(1),
    basis: sowingDate ? `sowing date ${sowingDate}` : "today's date (no sowing date saved for this crop)",
  };

  if (!crop) missing.push({ field: 'crop', label: 'Crop', fix: 'Select a crop from a recommendation on the Farms page, or choose one here' });
  if (acres === null) missing.push({ field: 'area', label: 'Farm area in acres or hectares', fix: `This farm's area is in ${farm.areaUnit || 'an unknown unit'}, which differs by state and isn't converted automatically. Edit the farm and enter acres or hectares.` });

  // ---- Soil Health Card ratings (official limits) ----
  const st = farm.soilTest || {};
  const nutrients = [];
  const ratingFor = {};
  for (const [key, lim] of Object.entries(RATED)) {
    const value = num(st[key]);
    const rating = value === null ? null : rate3(value, lim);
    if (['N', 'P', 'K'].includes(key)) ratingFor[key] = rating;
    nutrients.push({
      key, label: lim.label, unit: lim.unit, value, rating, kind: 'level',
      limits: `below ${lim.low} Low · ${lim.low}–${lim.high} Medium · above ${lim.high} High`,
    });
  }
  for (const [key, lim] of Object.entries(CRITICAL)) {
    const value = num(st[key]);
    nutrients.push({
      key, label: lim.label, unit: lim.unit, value, kind: 'critical',
      rating: value === null ? null : value < lim.limit ? 'Deficient' : 'Sufficient',
      limits: `deficient below ${lim.limit} ${lim.unit}`,
    });
  }
  const phValue = num(st.ph);
  const ecValue = num(st.ec);
  const soilReaction = {
    ph: phValue === null ? null : { value: phValue, class: phValue < 6.5 ? 'Acidic' : phValue > 7.0 ? 'Alkaline' : 'Neutral', limits: 'below 6.5 Acidic · 6.5–7.0 Neutral · above 7.0 Alkaline' },
    ec: ecValue === null ? null : { value: ecValue, class: ecValue > 4.0 ? 'Saline' : 'Normal', unit: 'dS/m', limits: 'above 4.0 dS/m Saline' },
  };

  const missingNPK = ['N', 'P', 'K'].filter((k) => ratingFor[k] === null);
  if (!farm.soilTest) {
    missing.push({ field: 'soilTest', label: 'Soil test (Soil Health Card values)', fix: 'Edit the farm → Soil test, and copy the values from your Soil Health Card' });
  } else if (missingNPK.length) {
    missing.push({ field: 'soilTest', label: `Soil test ${missingNPK.join(', ')}`, fix: 'Add the missing values from your Soil Health Card' });
  }

  // ---- ML rating model (shown alongside, flagged when it disagrees) ----
  const model = await modelAssessment(st, farm.soilType, season);
  const toLevel = (r) => (r === 'Low' ? 'Deficient' : r ? 'Sufficient' : null); // model's Low/Medium/High → critical-limit terms
  const disagreements = [];
  for (const n of nutrients) {
    const modelKey = n.kind === 'critical' ? CRITICAL[n.key].model : ['N', 'P', 'K'].includes(n.key) ? n.key : null;
    const m = modelKey && model.used ? model.ratings[modelKey] : null;
    n.model = m || null;
    if (m?.rating && n.rating) {
      n.agrees = n.kind === 'critical' ? toLevel(m.rating) === n.rating : m.rating === n.rating;
      if (!n.agrees) {
        disagreements.push(`${n.label}: Soil Health Card limits give ${n.rating}, the model says ${m.rating}`);
      }
    } else n.agrees = null;
  }
  if (model.used && disagreements.length) {
    limitations.push(`The ML rating model disagrees on ${disagreements.length} value(s) (${disagreements.join('; ')}). Its training labels appear to use slightly different limits near the boundaries. The dose follows the official ICAR-IISS limits; check the rating printed on your card.`);
  }

  // ---- Dose ----
  let fertPlan = null;
  let doseBasis = null;
  if (crop && acres !== null) {
    const specific = hasCropSpecificRule(crop.name);
    doseBasis = specific ? 'crop-specific' : 'generic';
    const rule = cropRule(crop.name);
    const adjust = Object.fromEntries(['N', 'P', 'K'].filter((k) => ratingFor[k]).map((k) => [k, DOSE_FACTOR[ratingFor[k]]]));
    const kbSoil = SOIL_MAP[norm(farm.soilType)] || 'unknown';
    fertPlan = fertilizePlan({
      crop: crop.name, areaAcres: acres, soilType: kbSoil,
      adjust: Object.keys(adjust).length ? adjust : null,
      soilTestedOn: st.testedOn || null,
    });
    fertPlan.baseDosePerAcre = { N: rule.n, P2O5: rule.p, K2O: rule.k };
    fertPlan.adjustments = ['N', 'P', 'K'].map((k) => ({
      nutrient: k === 'N' ? 'N' : k === 'P' ? 'P2O5' : 'K2O',
      rating: ratingFor[k] || null,
      factor: ratingFor[k] ? DOSE_FACTOR[ratingFor[k]] : 1,
      reason: ratingFor[k]
        ? `Soil ${k} is ${ratingFor[k]} → ${ratingFor[k] === 'Low' ? '25% more than' : ratingFor[k] === 'High' ? '25% less than' : 'the same as'} the crop dose`
        : `No soil ${k} value → crop dose unchanged`,
    }));
    if (!specific) {
      limitations.push(`KisanAI has no crop-specific fertilizer dose for ${crop.name}; the numbers use its generic default (${rule.n}:${rule.p}:${rule.k} kg N:P2O5:K2O per acre). Check your Soil Health Card's crop recommendation or your KVK before buying fertilizer.`);
    }
    if (crop.source === 'selected' && crop.inKnowledgeBase === false) {
      limitations.push(`${crop.name} is not in the KisanAI crop knowledge base.`);
    }
    // Dates from the farm's calendar (same split days the calendar uses)
    for (const step of fertPlan.schedule) {
      if (!sowingDate) continue;
      step.date = addDays(sowingDate, step.dayOffset);
      const ev = planForCrop?.events?.find((e) => e.type === 'fertilizer' && e.date === step.date);
      if (ev) step.calendarEvent = { title: ev.title, done: !!ev.done };
    }
  }

  // ---- Advisories (no invented doses) ----
  const advisories = [];
  for (const n of nutrients.filter((x) => x.kind === 'critical' && x.rating === 'Deficient')) {
    advisories.push(`${n.label} ${n.value} ${n.unit} is below the critical limit (${n.limits}). Follow the micronutrient advice printed on your Soil Health Card or ask your KVK — KisanAI doesn't prescribe micronutrient doses.`);
  }
  if (soilReaction.ec?.class === 'Saline') advisories.push(`EC ${soilReaction.ec.value} dS/m indicates saline soil. Ask your KVK about reclamation before relying on these doses.`);
  if (soilReaction.ph && soilReaction.ph.class !== 'Neutral') advisories.push(`Soil pH ${soilReaction.ph.value} is ${soilReaction.ph.class.toLowerCase()} (ICAR-IISS classes). If your card recommends an amendment (lime / gypsum), follow it.`);
  const ocRow = nutrients.find((n) => n.key === 'oc');
  if (ocRow?.rating === 'Low') advisories.push(`Organic carbon ${ocRow.value}% is Low — the farmyard manure advice below matters for this field.`);

  if (!model.used) limitations.push(`ML soil-rating model not used: ${model.reason}.`);
  limitations.push('Doses are general per-acre recommendations adjusted by your soil test. Your state agriculture department or Soil Health Card recommendation takes precedence where it differs.');

  const status = !crop || acres === null ? 'insufficient_data'
    : missingNPK.length || doseBasis === 'generic' ? 'partial' : 'ok';

  return {
    status,
    farm: { id: farm.id, name: farm.name, soilType: farm.soilType || null },
    crop: crop ? { name: crop.name, source: crop.source } : null,
    area: { acres, entered: `${farm.area} ${farm.areaUnit || 'acres'}` },
    season,
    calendar: planForCrop ? { planId: planForCrop.id, sowingDate: planForCrop.sowingDate } : null,
    soilTest: farm.soilTest ? { testedOn: st.testedOn || null } : null,
    ratings: { basis: 'ICAR-IISS Soil Health Card limits', nutrients, soilReaction },
    model,
    doseBasis,
    plan: fertPlan,
    advisories,
    missing,
    limitations,
    sources: Object.values(SOURCES),
  };
}
