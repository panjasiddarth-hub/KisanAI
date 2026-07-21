// src/agents/fertilizerAgent.js — Fertilizer Agent: crop + soil + stage → NPK plan
// Nutrient requirement per ACRE (kg of N, P2O5, K2O) — standard agronomy doses.
const FERT_RULES = {
  cotton:     { n: 50, p: 25, k: 25, splits: [['Basal (at sowing)', 0, 0.5], ['Vegetative (30 DAS)', 30, 0.25], ['Square formation (65 DAS)', 65, 0.25]] },
  soybean:    { n: 12, p: 32, k: 20, splits: [['Basal (at sowing)', 0, 1.0]] },
  paddy:      { n: 48, p: 24, k: 24, splits: [['Basal', 0, 0.5], ['Active tillering (25 DAT)', 25, 0.25], ['Panicle initiation (45 DAT)', 45, 0.25]] },
  wheat:      { n: 50, p: 25, k: 12, splits: [['Basal (at sowing)', 0, 0.5], ['Crown root init. (21 DAS)', 21, 0.25], ['Tillering (45 DAS)', 45, 0.25]] },
  maize:      { n: 60, p: 24, k: 16, splits: [['Basal', 0, 0.5], ['Knee-high (25 DAS)', 25, 0.25], ['Tasseling (45 DAS)', 45, 0.25]] },
  onion:      { n: 45, p: 25, k: 25, splits: [['Basal (transplant)', 0, 0.5], ['Bulb initiation (30 DAT)', 30, 0.25], ['Bulb development (50 DAT)', 50, 0.25]] },
  tomato:     { n: 100, p: 50, k: 50, splits: [['Basal (transplant)', 0, 0.33], ['First flowering (25 DAT)', 25, 0.33], ['Fruit set (45 DAT)', 45, 0.34]] },
  sugarcane:  { n: 110, p: 45, k: 40, splits: [['Basal (planting)', 0, 0.33], ['Tillering (45 DAP)', 45, 0.33], ['Grand growth (90 DAP)', 90, 0.34]] },
  chickpea:   { n: 10, p: 25, k: 0, splits: [['Basal (at sowing)', 0, 1.0]] },
  groundnut:  { n: 8, p: 16, k: 24, splits: [['Basal', 0, 1.0]] },
  potato:     { n: 60, p: 30, k: 40, splits: [['Basal', 0, 0.5], ['Earthing up (30 DAP)', 30, 0.5]] },
  mustard:    { n: 30, p: 15, k: 0, splits: [['Basal', 0, 0.5], ['Vegetative (25 DAS)', 25, 0.5]] },
  default:    { n: 40, p: 20, k: 20, splits: [['Basal (at sowing)', 0, 0.5], ['Vegetative (25 DAS)', 25, 0.25], ['Flowering (50 DAS)', 50, 0.25]] },
};

// Fertilizer products: N-P2O5-K2O content
const PRODUCTS = { urea: { N: 0.46 }, dap: { N: 0.18, P: 0.46 }, mop: { K: 0.60 }, ssp: { P: 0.16 } };
const r1 = (v) => Math.round(v * 10) / 10;

export function cropRule(cropName = '') {
  const key = Object.keys(FERT_RULES).find(k => cropName.toLowerCase().includes(k));
  return FERT_RULES[key || 'default'];
}

export function fertilizePlan({ crop, areaAcres = 1, soilType = 'loamy' }) {
  if (!crop) return { error: 'crop is required' };
  const area = Math.max(0.25, Number(areaAcres) || 1);
  const rule = cropRule(crop);

  // Soil adjustments
  let nAdj = 1, note = [];
  if (soilType === 'sandy') { nAdj = 1.1; note.push('Sandy soil leaches nitrogen — N raised 10%, split doses matter.'); }
  if (soilType === 'black') { nAdj = 0.95; note.push('Black soil holds nitrogen well — N trimmed 5%.'); }
  if (soilType === 'clay') { note.push('Clay soil: avoid waterlogging after urea top-dressing.'); }

  const N = r1(rule.n * nAdj), P2O5 = rule.p, K2O = rule.k;

  // Product arithmetic: DAP covers P first (its N is counted), rest N via urea, K via MOP.
  const dapKg = r1(P2O5 / PRODUCTS.dap.P);
  const nFromDap = r1((P2O5 / PRODUCTS.dap.P) * PRODUCTS.dap.N);
  const ureaKg = r1(Math.max(0, N - nFromDap) / PRODUCTS.urea.N);
  const mopKg = r1(K2O / PRODUCTS.mop.K);

  const perAcre = { nutrients: { N, P2O5, K2O }, products: { 'Urea (46% N)': ureaKg, 'DAP (18-46-0)': dapKg, 'MOP (60% K2O)': mopKg } };
  const totals = Object.fromEntries(Object.entries(perAcre.products).map(([k, v]) => [k, r1(v * area)]));

  const schedule = rule.splits.map(([stage, dayOffset, frac]) => ({
    stage, dayOffset, share: `${Math.round(frac * 100)}% of N`,
    productsPerAcre: {
      'Urea': `${r1(ureaKg * frac)} kg`,
      ...(dayOffset === 0 ? { 'DAP': `${dapKg} kg`, 'MOP': `${mopKg} kg` } : {}),
    },
    productsTotal: {
      'Urea': `${r1(ureaKg * frac * area)} kg`,
      ...(dayOffset === 0 ? { 'DAP': `${r1(dapKg * area)} kg`, 'MOP': `${r1(mopKg * area)} kg` } : {}),
    },
  }));

  const cautions = [
    'Apply urea only when soil has moisture; irrigate lightly after top-dressing.',
    'Never mix DAP with urea in the same furrow at sowing — seed burn risk.',
    'Do a soil test every 2 years; adjust P and K accordingly (your last test: 12 May 2024).',
    ...note,
  ];

  return {
    crop, areaAcres: area, soilType,
    perAcre, totals,
    schedule,
    organic: `Additionally apply well-decomposed FYM @ 2 tonnes/acre (≈ ${r1(2 * area)} t for your field) 15 days before sowing, and consider Rhizobium/Azotobacter bio-fertilizer seed treatment.`,
    cautions,
  };
}

export function fertilizerExplanation(plan) {
  const p = plan.perAcre.products;
  return (
    `For ${plan.areaAcres} acre(s) of ${plan.crop} in ${plan.soilType} soil, your crop needs about ` +
    `${plan.perAcre.nutrients.N} kg N, ${plan.perAcre.nutrients.P2O5} kg P2O5 and ${plan.perAcre.nutrients.K2O} kg K2O per acre. ` +
    `That works out to Urea ${p['Urea (46% N)']} kg, DAP ${p['DAP (18-46-0)']} kg and MOP ${p['MOP (60% K2O)']} kg per acre ` +
    `(total for your field: Urea ${plan.totals['Urea (46% N)']} kg). Give phosphorus and potash fully at sowing, ` +
    `and split nitrogen as shown below — this feeds the crop when it is hungriest and cuts fertilizer loss.`
  );
}
