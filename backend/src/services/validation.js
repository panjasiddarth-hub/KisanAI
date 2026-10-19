// src/services/validation.js — input validation shared by farm and plot routes.

// YYYY-MM-DD that is a real calendar date. `new Date('2026-02-31')` silently becomes 3 March,
// so the parsed date must round-trip to the same string.
export function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const addDaysStr = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// All 12 Soil Health Card parameters (N, P, K in kg/ha; EC dS/m; OC %; S and micronutrients ppm).
// Maxima only catch typos — they are far above anything a card would show.
export const SOIL_LIMITS = { N: 2000, P: 2000, K: 5000, ph: 14, ec: 50, oc: 20, s: 500, zn: 100, b: 50, fe: 1000, cu: 100, mn: 1000 };

// Soil test from a request body → { value, errors }. value is null when cleared or empty.
// Blank values are skipped (never defaulted); each bad value is named in the errors.
export function sanitizeSoilTest(raw, prefix = 'soilTest') {
  const errors = [];
  if (raw === null) return { value: null, errors };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { value: null, errors: [`${prefix} must be an object`] };
  const st = {};
  for (const k of Object.keys(SOIL_LIMITS)) {
    const v = raw[k];
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    const max = SOIL_LIMITS[k];
    if (!Number.isFinite(n) || n < 0 || n > max) errors.push(`${prefix}.${k} must be a number between 0 and ${max}`);
    else st[k] = n;
  }
  if (raw.testedOn) {
    if (!isDate(raw.testedOn)) errors.push(`${prefix}.testedOn must be a real date (YYYY-MM-DD)`);
    else if (raw.testedOn > todayStr()) errors.push(`${prefix}.testedOn cannot be in the future`);
    else st.testedOn = raw.testedOn;
  }
  return { value: Object.keys(st).length ? st : null, errors };
}

// Trimmed string with a length cap; undefined when absent.
export function cleanString(v, max) {
  if (v === undefined || v === null) return undefined;
  return String(v).trim().slice(0, max);
}
