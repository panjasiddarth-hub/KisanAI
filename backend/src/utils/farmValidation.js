const FARM_TEXT_LIMITS = {
  name: 120, location: 240, farmerName: 120, farmerPhone: 32, village: 120,
  district: 120, state: 120, areaUnit: 24, landOwnership: 40, soilType: 80,
  waterSource: 80, waterAvailability: 60, waterQuality: 60, season: 40,
  previousCrop: 100, cultivationMethod: 80,
};
const FARM_NUMBER_LIMITS = {
  area: { min: Number.EPSILON, max: 100_000, required: true },
  soilPH: { min: 0, max: 14 },
  soilEC: { min: 0, max: 100 },
  soilOC: { min: 0, max: 100 },
  soilN: { min: 0, max: 1_000_000 },
  soilP: { min: 0, max: 1_000_000 },
  soilK: { min: 0, max: 1_000_000 },
  soilS: { min: 0, max: 1_000_000 },
  soilZn: { min: 0, max: 1_000_000 },
  soilB: { min: 0, max: 1_000_000 },
  soilFe: { min: 0, max: 1_000_000 },
  soilCu: { min: 0, max: 1_000_000 },
  soilMn: { min: 0, max: 1_000_000 },
};
const FARM_ARRAY_LIMITS = { crops: 30, irrigationMethods: 10 };
const SOIL_SOURCE_FIELDS = ['soilPH', 'soilEC', 'soilOC', 'soilN', 'soilP', 'soilK', 'soilS', 'soilZn', 'soilB', 'soilFe', 'soilCu', 'soilMn'];
const SOIL_VALUE_SOURCES = ['soil_report_reviewed', 'farmer_entered'];

export function isJsonObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

export function validateFarmPayload(payload, { partial = false } = {}) {
  if (!isJsonObject(payload)) return { data: {}, errors: ['Request body must be a JSON object'] };
  const data = { ...payload };
  const errors = [];

  for (const [field, maxLength] of Object.entries(FARM_TEXT_LIMITS)) {
    if (!(field in data) || data[field] === undefined || data[field] === null) continue;
    if (typeof data[field] !== 'string' || data[field].length > maxLength) {
      errors.push(`${field} must be text of at most ${maxLength} characters`);
    } else {
      data[field] = data[field].trim();
      if ((field === 'name' || field === 'location') && !data[field]) errors.push(`${field} cannot be empty`);
    }
  }
  if (!partial) {
    for (const field of ['name', 'location']) {
      if (typeof data[field] !== 'string' || !data[field].trim()) errors.push(`${field} is required`);
    }
  }
  if (data.areaUnit !== undefined && !['acres', 'hectares', 'bigha'].includes(data.areaUnit)) {
    errors.push('areaUnit must be acres, hectares, or bigha');
  }

  for (const [field, rule] of Object.entries(FARM_NUMBER_LIMITS)) {
    if (!(field in data) || data[field] === undefined) {
      if (!partial && rule.required) errors.push(`${field} is required`);
      continue;
    }
    if ((data[field] === null || data[field] === '') && !rule.required) {
      data[field] = null;
      continue;
    }
    const value = parseNumber(data[field]);
    if (!Number.isFinite(value) || value < rule.min || value > rule.max) {
      errors.push(`${field} must be a number from ${rule.min} to ${rule.max}`);
    } else {
      data[field] = value;
    }
  }

  for (const [field, maxItems] of Object.entries(FARM_ARRAY_LIMITS)) {
    if (!(field in data) || data[field] === undefined || data[field] === null) continue;
    if (!Array.isArray(data[field]) || data[field].length > maxItems
      || data[field].some((item) => typeof item !== 'string' || item.length > 120)) {
      errors.push(`${field} must be a list of at most ${maxItems} text items (120 characters each)`);
    } else {
      data[field] = data[field].map((item) => item.trim());
    }
  }

  if (data.soilSources !== undefined) {
    if (!isJsonObject(data.soilSources)) {
      errors.push('soilSources must be an object of soil field sources');
    } else {
      const normalizedSources = {};
      for (const [field, source] of Object.entries(data.soilSources)) {
        if (!SOIL_SOURCE_FIELDS.includes(field) || !SOIL_VALUE_SOURCES.includes(source)) {
          errors.push(`soilSources.${field} is not a supported soil value source`);
        } else {
          normalizedSources[field] = source;
        }
      }
      data.soilSources = normalizedSources;
    }
  }

  if (data.soilTestDate !== undefined && data.soilTestDate !== null && data.soilTestDate !== '') {
    if (!isDateOnly(data.soilTestDate)) errors.push('soilTestDate must be a real date in YYYY-MM-DD format');
  }
  if (data.images !== undefined) {
    if (!Array.isArray(data.images) || data.images.length > 3 || data.images.some((image) =>
      typeof image !== 'string' || image.length > 1_500_000
      || !(/^(https:\/\/[^\s]+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+)$/i).test(image)
    )) {
      errors.push('images must contain at most 3 HTTPS URLs or JPEG, PNG, or WebP data URLs under 1.5 MB each');
    }
  }
  return { data, errors };
}
