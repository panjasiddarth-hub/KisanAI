import test from 'node:test';
import assert from 'node:assert/strict';
import { getFarmAssessmentReadiness } from './farmAssessmentReadiness.js';

test('reports all required fertilizer profile inputs for a complete profile', () => {
  const farm = {
    soilPH: 6.4, soilEC: 0.34, soilOC: 0.62, soilN: 280, soilP: 22, soilK: 265,
    soilS: 13, soilZn: 0.72, soilB: 0.48, soilFe: 4.1, soilCu: 0.46, soilMn: 2.8,
    soilType: 'Black Cotton', season: 'Kharif',
  };
  assert.deepEqual(getFarmAssessmentReadiness(farm), { complete: 14, total: 14, missing: [] });
});

test('does not count empty or unsupported values as ready', () => {
  const result = getFarmAssessmentReadiness({ soilPH: '', soilN: 'unknown', soilType: 'Sandy', season: 'Monsoon' });
  assert.equal(result.complete, 0);
  assert.equal(result.total, 14);
  assert.equal(result.missing.length, 14);
});
