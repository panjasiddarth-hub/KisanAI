// src/services/cropModelInputs.js — inputs for the trained crop model (crop_rec.pkl, random forest).
// The model needs all seven features. Missing or implausible values are never coerced (Number(undefined)
// used to become NaN → null in JSON → a 422 that was then reported as "ML service unavailable").
// Bounds only reject typos/impossible values; the ML service separately reports values outside
// the model's training range.
export const CROP_MODEL_FEATURES = {
  N: [0, 300], P: [0, 300], K: [0, 400], temperature: [-10, 60], humidity: [0, 100], ph: [0, 14], rainfall: [0, 5000],
};

export function cropModelInputs(input = {}) {
  const values = {};
  const missing = [];
  const invalid = [];
  for (const [k, [lo, hi]] of Object.entries(CROP_MODEL_FEATURES)) {
    const raw = input?.[k];
    if (raw === undefined || raw === null || raw === '') { missing.push(k); continue; }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < lo || n > hi) invalid.push(k);
    else values[k] = n;
  }
  const ok = !missing.length && !invalid.length;
  const reason = ok ? null : [
    missing.length ? `missing ${missing.join(', ')}` : '',
    invalid.length ? `invalid ${invalid.join(', ')}` : '',
  ].filter(Boolean).join('; ');
  return { ok, values, missing, invalid, reason };
}
