import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceAgentValidation, reviewCropContext, validateAgentInput, validateAgentRun } from './validationAgent.js';

const fertilizerInput = {
  pH: 6.5,
  EC_dS_per_m: 0.5,
  OC_percent: 0.7,
  N_kg_per_ha: 100,
  P_kg_per_ha: 40,
  K_kg_per_ha: 80,
  S_ppm: 15,
  Zn_ppm: 1.2,
  B_ppm: 0.5,
  Fe_ppm: 5,
  Cu_ppm: 1,
  Mn_ppm: 3,
  Soil_Type: 'Alluvial',
  Season: 'Kharif',
};

const marketInput = {
  lag_1: 2000,
  lag_2: 1950,
  lag_3: 2050,
  rolling_mean_3: 2000,
  rolling_std_3: 50,
  month: 7,
  day_of_year: 190,
  Commodity: 'Bajra',
  Market: 'Akbarpur Mandi',
  State: 'Uttar Pradesh',
};

test('accepts fertilizer categorical soil and season fields', () => {
  assert.deepEqual(validateAgentInput('fertilizer', fertilizerInput), []);
  assert.ok(validateAgentInput('fertilizer', { ...fertilizerInput, Soil_Type: 'Unknown soil' }).includes('Input Soil_Type must be one of the supported model categories'));
  assert.ok(validateAgentInput('fertilizer', { ...fertilizerInput, Season: 'Monsoon' }).includes('Input Season must be Kharif, Rabi, or Zaid'));
});

test('accepts market commodity, market, and state strings', () => {
  assert.deepEqual(validateAgentInput('market', marketInput), []);
});

test('rejects market calendar values outside the model schema', () => {
  assert.ok(validateAgentInput('market', { ...marketInput, month: 13 }).includes('Input month must be an integer from 1 to 12'));
  assert.ok(validateAgentInput('market', { ...marketInput, day_of_year: 367 }).includes('Input day_of_year must be an integer from 1 to 366'));
});

test('rejects non-object and physically invalid crop inputs', () => {
  assert.ok(validateAgentInput('crop', ['not', 'an', 'object']).length > 0);
  const crop = { N: 10, P: 20, K: 30, temperature: 25, humidity: 60, ph: 6, rainfall: 100 };
  assert.ok(validateAgentInput('crop', { ...crop, temperature: 90 }).includes('Temperature must be between -50 and 70 °C'));
  assert.ok(validateAgentInput('crop', { ...crop, humidity: 110 }).includes('Humidity must be between 0 and 100 percent'));
});

test('limits knowledge-retrieval prompt size and result count', () => {
  assert.deepEqual(validateAgentInput('rag', { question: 'How should I store seed?', top_k: 3 }), []);
  assert.ok(validateAgentInput('rag', { question: 'x'.repeat(2_001), top_k: 3 }).includes('Input question must be at most 2000 characters'));
  assert.ok(validateAgentInput('rag', { question: 'Help', top_k: 100 }).includes('Input top_k must be an integer from 1 to 10'));
});

test('rejects incomplete fertilizer model output', () => {
  const result = validateAgentRun({
    fertilizer: {
      input: fertilizerInput,
      result: { ratings: { N: 'Low' } },
    },
  });
  assert.equal(result.status, 'needs_review');
  assert.ok(result.checks[0].issues.some((issue) => issue.includes('missing or invalid P rating')));
});

test('blocks model output that validation marks for review', () => {
  const runs = {
    crop: {
      input: { N: 10, P: 20, K: 30, temperature: 25, humidity: 60, ph: 6, rainfall: 100 },
      result: { prediction: 'rice', recommendations: [{ crop: 'rice', rank: 1, confidence: 75 }] },
    },
  };
  const validation = validateAgentRun(runs);
  const enforced = enforceAgentValidation(runs, validation);

  assert.equal(validation.status, 'needs_review');
  assert.match(enforced.crop.error, /^Validation needs review:/);
  assert.equal(enforced.crop.result, undefined);
});

test('classifies agent service errors as failed rather than model-output review', () => {
  const validation = validateAgentRun({ crop: { input: {}, error: 'ML service unavailable' } });
  assert.equal(validation.status, 'failed');
  assert.equal(validation.checks[0].status, 'failed');
  assert.deepEqual(validation.checks[0].issues, ['ML service unavailable']);
});

test('reviews crop input sources and farm context without claiming context changed the ranking', () => {
  const review = reviewCropContext(
    { N: 80, P: 40, K: 35, temperature: 28, humidity: 65, ph: 6.4, rainfall: 900 },
    {
      farm: {
        location: 'Village, District, State', season: 'Kharif', soilType: 'Alluvial',
        waterSource: 'Canal', waterAvailability: 'Seasonal', previousCrop: 'Chickpea',
        soilTestDate: '2026-05-01', soilSources: { soilN: 'soil_report_reviewed' },
      },
      inputSources: { N: 'soil_report_reviewed', temperature: 'current_weather_service', rainfall: 'farmer_entered' },
    },
  );
  assert.equal(review.modelInputs.find(item => item.field === 'N').source, 'farmer-reviewed soil report');
  assert.equal(review.modelInputs.find(item => item.field === 'temperature').source, 'current weather service');
  assert.equal(review.modelInputs.find(item => item.field === 'rainfall').source, 'entered by farmer');
  assert.equal(review.farmContext.find(item => item.field === 'Season').value, 'Kharif');
  assert.ok(review.notes[0].includes('does not change the ranking'));
});
