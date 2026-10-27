import test from 'node:test';
import assert from 'node:assert/strict';
import { getGeneralFertilizerRequirements, getOfficialCropsForState, getPersonalizedFertilizerRecommendation, getShcEndpoint, isShcConfigured, SoilHealthCardError } from './soilHealthCard.js';

test('requires an SHC token and rejects non-approved endpoint hosts', () => {
  assert.throws(() => getShcEndpoint({}), { status: 503 });
  assert.throws(() => getShcEndpoint({ SHC_API_TOKEN: 'token', SHC_API_URL: 'http://soilhealth4.dac.gov.in' }), { status: 503 });
  assert.throws(() => getShcEndpoint({ SHC_API_TOKEN: 'token', SHC_API_URL: 'https://example.com' }), { status: 503 });
  assert.equal(isShcConfigured({}), false);
  assert.equal(isShcConfigured({ SHC_API_TOKEN: 'token' }), true);
  assert.equal(isShcConfigured({ SHC_API_TOKEN: 'token', SHC_API_URL: 'https://example.com' }), false);
});

test('queries official regional requirements with only state, crop and district', async () => {
  const requests = [];
  const result = await getGeneralFertilizerRequirements(
    { state: 'Maharashtra', district: 'Nashik', crop: 'rice' },
    {
      env: { SHC_API_TOKEN: 'test-token' },
      now: () => new Date('2026-10-23T00:00:00.000Z'),
      fetchImpl: async (url, options) => {
        const request = { url, ...options, body: JSON.parse(options.body) };
        requests.push(request);
        const data = requests.length === 1
          ? { getState: [{ name: 'Maharashtra', id: 'state-27' }] }
          : { getGFRs: [{ crop: { name: 'rice', id: '1' }, region: 'Nashik', nutrients: { N: 'example' } }] };
        return { ok: true, json: async () => ({ data }) };
      },
    },
  );
  assert.equal(requests[0].url, 'https://soilhealth4.dac.gov.in/');
  assert.equal(requests[0].headers.token, 'test-token');
  assert.equal(requests[0].body.query, 'query GetStates { getState }');
  assert.deepEqual(requests[1].body.variables, { state: 'state-27', crop: 'rice', district: 'Nashik' });
  assert.equal(result.scope, 'regional_general_fertilizer_recommendation');
  assert.equal(result.results[0].crop.name, 'rice');
  assert.equal(result.retrievedAt, '2026-10-23T00:00:00.000Z');
});

test('converts network and GraphQL failures into safe errors', async () => {
  const options = { env: { SHC_API_TOKEN: 'test-token' } };
  await assert.rejects(getGeneralFertilizerRequirements({ state: 's', district: 'd', crop: 'c' }, {
    ...options, fetchImpl: async () => { throw new Error('secret detail'); },
  }), (error) => error instanceof SoilHealthCardError && error.status === 503 && !error.message.includes('secret'));
  await assert.rejects(getGeneralFertilizerRequirements({ state: 's', district: 'd', crop: 'c' }, {
    ...options, fetchImpl: async () => ({ ok: true, json: async () => ({ errors: [{ message: 'internal' }] }) }),
  }), { status: 502 });
});

test('loads official crop names and regional-reference availability by resolved state ID', async () => {
  const requests = [];
  const result = await getOfficialCropsForState('Maharashtra', {
    env: { SHC_API_TOKEN: 'test-token' },
    now: () => new Date('2026-10-23T00:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return { ok: true, json: async () => ({ data: requests.length === 1
        ? { getState: [{ name: 'Maharashtra', id: 'state-27' }] }
        : { getCrops: [{ id: 'crop-1', name: 'Rice', region: 'West', GFRavailable: true }] } }) };
    },
  });
  assert.deepEqual(requests[1].variables, { state: 'state-27' });
  assert.equal(result.crops[0].name, 'Rice');
  assert.equal(result.crops[0].GFRavailable, true);
  assert.equal(result.retrievedAt, '2026-10-23T00:00:00.000Z');
});

test('requests a soil-test-specific crop recommendation using the official SHC operation', async () => {
  const requests = [];
  const result = await getPersonalizedFertilizerRecommendation({
    state: 'Maharashtra', cropId: 'crop-rice', cropName: 'Rice', results: { N: 180, P: 24, K: 160 },
  }, {
    env: { SHC_API_TOKEN: 'test-token' },
    now: () => new Date('2026-10-27T00:00:00.000Z'),
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);
      return { ok: true, json: async () => ({ data: requests.length === 1
        ? { getState: [{ name: 'Maharashtra', id: 'state-27' }] }
        : { getRecommendations: [{ crop: 'Rice', nutrientRequirement: { N: 'official value' } }] } }) };
    },
  });
  assert.deepEqual(requests[1].variables, { state: 'state-27', crops: ['crop-rice'], results: { N: 180, P: 24, K: 160 } });
  assert.match(requests[1].query, /getRecommendations\(state: \$state, crops: \$crops, results: \$results\)/);
  assert.equal(result.personalized, true);
  assert.equal(result.scope, 'soil_test_crop_recommendation');
  assert.equal(result.results[0].nutrientRequirement.N, 'official value');
});

test('requires an official crop and complete NPK readings for personalized recommendations', async () => {
  await assert.rejects(getPersonalizedFertilizerRecommendation({
    state: 'Maharashtra', cropId: '', cropName: 'Rice', results: { N: 1, P: 2, K: 3 },
  }), { status: 400 });
  await assert.rejects(getPersonalizedFertilizerRecommendation({
    state: 'Maharashtra', cropId: 'crop-rice', cropName: 'Rice', results: { N: 1, P: null, K: 3 },
  }), { status: 400 });
});

test('does not request crop catalog when portal state mapping is missing', async () => {
  let requestCount = 0;
  await assert.rejects(getOfficialCropsForState('Unknown State', {
    env: { SHC_API_TOKEN: 'test-token' },
    fetchImpl: async () => {
      requestCount += 1;
      return { ok: true, json: async () => ({ data: { getState: [{ name: 'Maharashtra', id: 'state-27' }] } }) };
    },
  }), { status: 422 });
  assert.equal(requestCount, 1);
});
