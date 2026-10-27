const DEFAULT_SHC_URL = 'https://soilhealth4.dac.gov.in/';
const ALLOWED_SHC_HOSTS = new Set(['soilhealth4.dac.gov.in', 'shc-staging.ddns.net']);

export class SoilHealthCardError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'SoilHealthCardError';
    this.status = status;
  }
}

export function getShcEndpoint(env = process.env) {
  if (!env.SHC_API_TOKEN) throw new SoilHealthCardError('Official Soil Health Card lookup is not configured.', 503);
  const endpoint = env.SHC_API_URL || DEFAULT_SHC_URL;
  let parsed;
  try { parsed = new URL(endpoint); }
  catch { throw new SoilHealthCardError('Official Soil Health Card endpoint configuration is invalid.', 503); }
  if (parsed.protocol !== 'https:' || !ALLOWED_SHC_HOSTS.has(parsed.hostname)) {
    throw new SoilHealthCardError('Official Soil Health Card endpoint must use an approved HTTPS host.', 503);
  }
  return { endpoint: parsed.toString(), token: env.SHC_API_TOKEN };
}

export function isShcConfigured(env = process.env) {
  try {
    getShcEndpoint(env);
    return true;
  } catch {
    return false;
  }
}

function createGraphQLRequester({ endpoint, token, fetchImpl }) {
  return async (query, variables = undefined) => {
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify(variables ? { query, variables } : { query }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SoilHealthCardError('Official Soil Health Card service could not be reached.', 503);
    }
    if (!response.ok) throw new SoilHealthCardError('Official Soil Health Card service returned an error.', 502);
    const payload = await response.json().catch(() => null);
    if (!payload || (Array.isArray(payload.errors) && payload.errors.length)) {
      throw new SoilHealthCardError('Official Soil Health Card service did not return a valid result.', 502);
    }
    return payload.data;
  };
}

async function resolveStateId(state, requestGraphQL) {
  const stateData = await requestGraphQL('query GetStates { getState }');
  const stateRows = Array.isArray(stateData?.getState) ? stateData.getState : [];
  const selectedState = stateRows.find((entry) => {
    const name = typeof entry === 'string' ? entry : entry?.name || entry?.state;
    return typeof name === 'string' && name.trim().toLocaleLowerCase() === state.trim().toLocaleLowerCase();
  });
  const stateId = typeof selectedState === 'object' && selectedState
    ? selectedState.id || selectedState._id || selectedState.value
    : null;
  if (!stateId) {
    throw new SoilHealthCardError('The official portal did not match this farm state to a state ID. Check the state name on the farm profile.', 422);
  }
  return String(stateId);
}

function createRequestGraphQL(env, fetchImpl) {
  const { endpoint, token } = getShcEndpoint(env);
  return createGraphQLRequester({ endpoint, token, fetchImpl });
}

export async function getOfficialCropsForState(state, {
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  const requestGraphQL = createRequestGraphQL(env, fetchImpl);
  const stateId = await resolveStateId(state, requestGraphQL);
  const data = await requestGraphQL(`query GetCrops($state: String) {
    getCrops(state: $state) { id name region GFRavailable }
  }`, { state: stateId });
  const crops = Array.isArray(data?.getCrops) ? data.getCrops : [];
  return {
    source: 'Soil Health Card Portal, Government of India',
    retrievedAt: now().toISOString(),
    crops: crops.filter((crop) => crop && typeof crop.id === 'string' && typeof crop.name === 'string'),
  };
}

export async function getGeneralFertilizerRequirements({ state, district, crop }, {
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  const requestGraphQL = createRequestGraphQL(env, fetchImpl);
  const stateId = await resolveStateId(state, requestGraphQL);
  const query = `query GetGFRs($state: ID, $crop: String, $district: String) {
    getGFRs(state: $state, crop: $crop, district: $district) {
      crop { name id }
      region
      nutrients
    }
  }`;
  const data = await requestGraphQL(query, { state: stateId, crop, district });
  return {
    source: 'Soil Health Card Portal, Government of India',
    sourceUrl: 'https://soilhealth.dac.gov.in/',
    retrievedAt: now().toISOString(),
    scope: 'regional_general_fertilizer_recommendation',
    results: data?.getGFRs ?? [],
  };
}

export async function getPersonalizedFertilizerRecommendation({ state, cropId, cropName, results }, {
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
} = {}) {
  if (typeof cropId !== 'string' || !cropId.trim() || cropId.length > 120) {
    throw new SoilHealthCardError('Choose a crop from the official regional crop list.', 400);
  }
  if (!results || !['N', 'P', 'K'].every((key) => results[key] !== null && results[key] !== undefined
    && Number.isFinite(Number(results[key])) && Number(results[key]) >= 0)) {
    throw new SoilHealthCardError('A complete non-negative NPK soil test is required for a personalized recommendation.', 400);
  }
  const requestGraphQL = createRequestGraphQL(env, fetchImpl);
  const stateId = await resolveStateId(state, requestGraphQL);
  const query = `query GetRecommendations($state: ID!, $crops: [ID!], $results: JSON!) {
    getRecommendations(state: $state, crops: $crops, results: $results)
  }`;
  const data = await requestGraphQL(query, {
    state: stateId,
    crops: [cropId],
    results,
  });
  const portalResult = data?.getRecommendations ?? null;
  return {
    source: 'Soil Health Card Portal, Government of India',
    sourceUrl: 'https://soilhealth.dac.gov.in/',
    retrievedAt: now().toISOString(),
    scope: 'soil_test_crop_recommendation',
    personalized: true,
    crop: cropName,
    inputsUsed: results,
    results: portalResult === null ? [] : Array.isArray(portalResult) ? portalResult : [portalResult],
  };
}
