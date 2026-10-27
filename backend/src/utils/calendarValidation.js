import { isDateOnly, isJsonObject } from './farmValidation.js';

export function validateCalendarPayload(payload, cropNames) {
  if (!isJsonObject(payload)) return { data: {}, errors: ['Request body must be a JSON object'] };
  const errors = [];
  const crop = typeof payload.crop === 'string' ? payload.crop.trim() : '';
  const supportedCrop = cropNames.find((name) => name.toLowerCase() === crop.toLowerCase());
  if (!supportedCrop) errors.push('crop must be a supported crop name');

  const sowingDate = payload.sowingDate;
  if (!isDateOnly(sowingDate)) errors.push('sowingDate must be a real date in YYYY-MM-DD format');

  const rawArea = payload.areaAcres === undefined ? 1 : payload.areaAcres;
  const areaAcres = typeof rawArea === 'number'
    ? rawArea
    : typeof rawArea === 'string' && rawArea.trim() ? Number(rawArea) : Number.NaN;
  if (!Number.isFinite(areaAcres) || areaAcres < 0.1 || areaAcres > 100_000) {
    errors.push('areaAcres must be a number from 0.1 to 100000');
  }

  const farmName = payload.farmName === undefined ? 'My Farm' : payload.farmName;
  if (typeof farmName !== 'string' || !farmName.trim() || farmName.length > 120) {
    errors.push('farmName must contain 1 to 120 characters');
  }
  const farmId = payload.farmId === undefined || payload.farmId === '' ? '' : payload.farmId;
  if (typeof farmId !== 'string' || farmId.length > 64) {
    errors.push('farmId must be a valid saved-farm ID');
  }
  return {
    data: { crop: supportedCrop || crop, sowingDate, areaAcres, farmName: typeof farmName === 'string' ? farmName.trim() : farmName, farmId },
    errors,
  };
}

export function validateCalendarEventUpdate(payload, eventIndex) {
  if (!isJsonObject(payload)) return ['Request body must be a JSON object'];
  if (!Number.isInteger(eventIndex) || eventIndex < 0 || eventIndex > 200) {
    return ['Event index must be an integer from 0 to 200'];
  }
  const keys = Object.keys(payload);
  if (keys.length !== 1 || !['done', 'date'].includes(keys[0])) {
    return ['Provide exactly one supported event update: done or date'];
  }
  if ('done' in payload && typeof payload.done !== 'boolean') return ['done must be true or false'];
  if ('date' in payload && !isDateOnly(payload.date)) return ['date must be a real date in YYYY-MM-DD format'];
  return [];
}
