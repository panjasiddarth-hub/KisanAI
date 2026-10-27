import { isDateOnly } from './farmValidation.js';

const SOIL_VALUE_MAXIMA = {
  soilPH: 14,
  soilEC: 100,
  soilOC: 100,
  soilN: 1_000_000,
  soilP: 1_000_000,
  soilK: 1_000_000,
  soilS: 1_000_000,
  soilZn: 1_000_000,
  soilB: 1_000_000,
  soilFe: 1_000_000,
  soilCu: 1_000_000,
  soilMn: 1_000_000,
};

export function verifiedSoilReportMime(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export function cleanSoilExtraction(extraction) {
  const numberField = (field, max) => {
    const entry = extraction?.[field];
    const value = entry?.value;
    return {
      value: typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : null,
      unit: typeof entry?.unit === 'string' ? entry.unit.slice(0, 32) : null,
      confidence: ['high', 'medium', 'low'].includes(entry?.confidence) ? entry.confidence : 'low',
    };
  };

  const result = Object.fromEntries(Object.entries(SOIL_VALUE_MAXIMA).map(([field, max]) => [field, numberField(field, max)]));
  const date = extraction?.soilTestDate;
  result.soilTestDate = typeof date === 'string' && isDateOnly(date) ? date : null;
  return result;
}
