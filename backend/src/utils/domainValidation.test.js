import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFarmPayload, isDateOnly } from './farmValidation.js';
import { validateCropPayload } from './cropValidation.js';
import { validateCalendarEventUpdate, validateCalendarPayload } from './calendarValidation.js';

test('validates and normalizes farm measurements and optional soil values', () => {
  const result = validateFarmPayload({ name: ' North ', location: 'Village, State', area: '2.5', areaUnit: 'acres', soilPH: '6.5', soilN: '', images: ['data:image/jpeg;base64,SGVsbG8='] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.data.name, 'North');
  assert.equal(result.data.area, 2.5);
  assert.equal(result.data.soilPH, 6.5);
  assert.equal(result.data.soilN, null);
});

test('accepts optional map coordinates and rejects out-of-range farm pins', () => {
  const valid = validateFarmPayload({ name: 'Mapped Farm', location: 'Village, State', area: 2, latitude: '17.385', longitude: '78.4867' });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.data.latitude, 17.385);
  assert.equal(valid.data.longitude, 78.4867);
  assert.ok(validateFarmPayload({ latitude: 91 }, { partial: true }).errors.some(error => error.startsWith('latitude must be')));
  assert.ok(validateFarmPayload({ longitude: -181 }, { partial: true }).errors.some(error => error.startsWith('longitude must be')));
});

test('rejects invalid farm area, pH, date, and unsafe image data', () => {
  const result = validateFarmPayload({ name: 'Farm', location: 'Somewhere', area: 0, soilPH: 15, soilTestDate: '2026-02-30', images: ['javascript:alert(1)'] });
  assert.ok(result.errors.some((error) => error.startsWith('area must be')));
  assert.ok(result.errors.some((error) => error.startsWith('soilPH must be')));
  assert.ok(result.errors.includes('soilTestDate must be a real date in YYYY-MM-DD format'));
  assert.ok(result.errors.some((error) => error.startsWith('images must contain')));
});

test('accepts only explicit soil-reading source labels', () => {
  const valid = validateFarmPayload({
    name: 'Farm', location: 'Village, State', area: 2,
    soilPH: 6.5,
    soilSources: { soilPH: 'soil_report_reviewed', soilN: 'farmer_entered' },
  });
  assert.deepEqual(valid.errors, []);
  assert.deepEqual(valid.data.soilSources, { soilPH: 'soil_report_reviewed', soilN: 'farmer_entered' });

  const invalid = validateFarmPayload({
    name: 'Farm', location: 'Village, State', area: 2,
    soilSources: { soilPH: 'lab_verified', internalField: 'farmer_entered' },
  });
  assert.equal(invalid.errors.length, 2);
});

test('validates additional soil-report measurements used by the nutrient model', () => {
  const valid = validateFarmPayload({
    name: 'Farm', location: 'Village, State', area: 2,
    soilEC: 0.8, soilOC: 0.7, soilS: 15, soilZn: 1.2, soilB: 0.5,
    soilFe: 5, soilCu: 1, soilMn: 3,
    soilSources: {
      soilEC: 'soil_report_reviewed', soilOC: 'soil_report_reviewed',
      soilS: 'soil_report_reviewed', soilZn: 'soil_report_reviewed',
      soilB: 'soil_report_reviewed', soilFe: 'soil_report_reviewed',
      soilCu: 'soil_report_reviewed', soilMn: 'soil_report_reviewed',
    },
  });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.data.soilEC, 0.8);
  assert.equal(valid.data.soilMn, 3);
  assert.ok(validateFarmPayload({ soilEC: 101 }, { partial: true }).errors.some(error => error.startsWith('soilEC must be')));
});

test('validates crop dates, positive area, progress, and harvest order', () => {
  const valid = validateCropPayload({ name: 'Wheat', area: '2.5', progress: '50', sowingDate: '2026-11-15', expectedHarvest: '2027-03-20' });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.data.area, 2.5);
  const invalid = validateCropPayload({ name: 'Wheat', area: 0, progress: 101, sowingDate: '2026-02-30', expectedHarvest: '2026-01-01' });
  assert.ok(invalid.errors.length >= 3);
  assert.ok(validateCropPayload({ area: '' }, { partial: true }).errors.includes('area is required'));
});

test('accepts only supported calendar crops, real dates, and bounded area', () => {
  const valid = validateCalendarPayload({ crop: 'cotton', sowingDate: '2026-10-22', areaAcres: '2' }, ['Cotton', 'Wheat']);
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.data.crop, 'Cotton');
  assert.equal(valid.data.areaAcres, 2);
  assert.ok(validateCalendarPayload({ crop: 'Unknown', sowingDate: '2026-02-30', areaAcres: -1 }, ['Cotton']).errors.length >= 3);
});

test('validates calendar event completion payloads', () => {
  assert.deepEqual(validateCalendarEventUpdate({ done: true }, 0), []);
  assert.deepEqual(validateCalendarEventUpdate({ date: '2026-10-24' }, 0), []);
  assert.ok(validateCalendarEventUpdate({ date: '2026-02-30' }, 0).length > 0);
  assert.ok(validateCalendarEventUpdate({ done: true, date: '2026-10-24' }, 0).length > 0);
  assert.ok(validateCalendarEventUpdate({ done: 'yes' }, -1).length > 0);
  assert.equal(isDateOnly('2024-02-29'), true);
});
