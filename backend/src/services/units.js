// src/services/units.js — the one place area units are converted (farms, plots, calendar, agents).
//
// Factors are exact definitions: 1 acre = 4046.8564224 m², 1 guntha = 1/40 acre (121 sq yd),
// 1 cent = 1/100 acre (435.6 sq ft). Hectares keep the 2.47105 factor the farm features have
// always used, so existing results (e.g. 2 ha → 4.94 ac) don't change.
// Bigha differs by state (roughly 0.25–1.6 acres), so it is never converted automatically.

export const ACRES_PER_UNIT = {
  acres: 1,
  hectares: 2.47105,
  guntha: 1 / 40,
  cents: 1 / 100,
  sqm: 1 / 4046.8564224,
};

export const AREA_UNITS = [...Object.keys(ACRES_PER_UNIT), 'bigha'];

export const UNIT_LABELS = {
  acres: 'acres', hectares: 'hectares', guntha: 'guntha', cents: 'cents', sqm: 'm²', bigha: 'bigha',
};

export const UNCONVERTIBLE_UNIT_NOTE =
  'Bigha differs from state to state, so KisanAI does not convert it. Enter the area in acres, hectares, guntha, cents or m² for calculations and area checks.';

const round = (v, dp) => Math.round(v * 10 ** dp) / 10 ** dp;

// Area → acres (4 decimals ≈ 0.4 m²). Null when the value or unit can't be converted reliably.
export function toAcres(area, unit = 'acres') {
  const factor = ACRES_PER_UNIT[unit || 'acres'];
  const a = Number(area);
  if (!factor || !Number.isFinite(a) || a <= 0) return null;
  return round(a * factor, 4);
}

export const acresToHectares = (acres) => (acres == null ? null : round(acres / ACRES_PER_UNIT.hectares, 4));

// Sums of rounded plot areas may exceed the farm area by a hair (2 × 1 ha = 4.9422 ac vs 4.9421 ac).
export const AREA_TOLERANCE_ACRES = 0.001;
