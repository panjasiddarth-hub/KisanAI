import { isDateOnly, isJsonObject } from './farmValidation.js';

const TEXT_LIMITS = { name: 100, variety: 100, stage: 60, notes: 2_000 };
const NUMBER_LIMITS = {
  area: { min: Number.EPSILON, max: 100_000, required: true },
  progress: { min: 0, max: 100 },
  yield: { min: 0, max: 1_000_000 },
};

function numericValue(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

export function validateCropPayload(payload, { partial = false } = {}) {
  if (!isJsonObject(payload)) return { data: {}, errors: ['Request body must be a JSON object'] };
  const data = { ...payload };
  const errors = [];

  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    if (!(field in data) || data[field] === undefined || data[field] === null) continue;
    if (typeof data[field] !== 'string' || data[field].length > maxLength) {
      errors.push(`${field} must be text of at most ${maxLength} characters`);
    } else {
      data[field] = data[field].trim();
      if (field === 'name' && !data[field]) errors.push('name cannot be empty');
    }
  }
  if (!partial && (typeof data.name !== 'string' || !data.name.trim())) errors.push('name is required');

  for (const [field, rule] of Object.entries(NUMBER_LIMITS)) {
    if (!(field in data) || data[field] === undefined) {
      if (!partial && rule.required) errors.push(`${field} is required`);
      continue;
    }
    if (data[field] === null || data[field] === '') {
      if (rule.required) errors.push(`${field} is required`);
      continue;
    }
    const value = numericValue(data[field]);
    if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      errors.push(`${field} must be a number from ${rule.min} to ${rule.max}`);
    } else {
      data[field] = value;
    }
  }

  for (const field of ['sowingDate', 'expectedHarvest']) {
    if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === '') continue;
    if (!isDateOnly(data[field])) errors.push(`${field} must be a real date in YYYY-MM-DD format`);
  }
  if (data.sowingDate && data.expectedHarvest && data.expectedHarvest < data.sowingDate) {
    errors.push('expectedHarvest cannot be before sowingDate');
  }
  return { data, errors };
}
