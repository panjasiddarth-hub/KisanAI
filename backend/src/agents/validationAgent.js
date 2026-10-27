const CROP_FIELDS = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'];
const CROP_SOURCE_LABELS = {
  soil_report_reviewed: 'farmer-reviewed soil report',
  farmer_entered: 'entered by farmer',
  farm_profile_source_unknown: 'saved farm value; source not recorded',
  current_weather_service: 'current weather service',
  not_recorded: 'source not recorded',
};
const FERTILIZER_FIELDS = [
  'pH', 'EC_dS_per_m', 'OC_percent', 'N_kg_per_ha', 'P_kg_per_ha',
  'K_kg_per_ha', 'S_ppm', 'Zn_ppm', 'B_ppm', 'Fe_ppm', 'Cu_ppm', 'Mn_ppm',
  'Soil_Type', 'Season',
];
const MARKET_FIELDS = [
  'lag_1', 'lag_2', 'lag_3', 'rolling_mean_3', 'rolling_std_3',
  'month', 'day_of_year', 'Commodity', 'Market', 'State',
];
const NUMERIC_FIELDS = {
  crop: new Set(CROP_FIELDS),
  fertilizer: new Set([
    'pH', 'EC_dS_per_m', 'OC_percent', 'N_kg_per_ha', 'P_kg_per_ha',
    'K_kg_per_ha', 'S_ppm', 'Zn_ppm', 'B_ppm', 'Fe_ppm', 'Cu_ppm', 'Mn_ppm',
  ]),
  market: new Set([
    'lag_1', 'lag_2', 'lag_3', 'rolling_mean_3', 'rolling_std_3',
    'month', 'day_of_year',
  ]),
};
const REQUIRED_NUTRIENTS = ['N', 'P', 'K', 'S', 'Zn', 'B', 'Fe', 'Cu', 'Mn'];
const NUTRIENT_RATINGS = new Set(['Low', 'Medium', 'High']);
const FERTILIZER_SOIL_TYPES = new Set(['Alluvial', 'Black (Regur)', 'Clay Loam', 'Laterite', 'Red', 'Sandy Loam']);
const FERTILIZER_SEASONS = new Set(['Kharif', 'Rabi', 'Zaid']);

function inspectInput(agent, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['Input must be a JSON object'];
  }

  if (agent === 'rag') {
    const problems = [];
    if (typeof input.question !== 'string' || !input.question.trim()) {
      problems.push('Input question must be a non-empty string');
    } else if (input.question.length > 2_000) {
      problems.push('Input question must be at most 2000 characters');
    }
    const topK = input.top_k === undefined ? 3 : Number(input.top_k);
    if (!Number.isInteger(topK) || topK < 1 || topK > 10) {
      problems.push('Input top_k must be an integer from 1 to 10');
    }
    return problems;
  }

  const fields = {
    crop: CROP_FIELDS,
    fertilizer: FERTILIZER_FIELDS,
    market: MARKET_FIELDS,
  }[agent];
  if (!fields) return [];

  const problems = [];
  for (const field of fields) {
    const value = input?.[field];
    if (value === undefined || value === null || value === '') {
      problems.push(`Missing required input: ${field}`);
    } else if (NUMERIC_FIELDS[agent].has(field)) {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        problems.push(`Input ${field} must be a finite number`);
      } else if (agent === 'crop' && ['N', 'P', 'K', 'rainfall'].includes(field) && numericValue < 0) {
        problems.push(`Input ${field} must be zero or greater`);
      } else if (agent === 'fertilizer' && numericValue < 0) {
        problems.push(`Input ${field} must be zero or greater`);
      } else if (agent === 'market' && numericValue < 0) {
        problems.push(`Input ${field} must be zero or greater`);
      } else if (agent === 'market' && field === 'month' && (numericValue < 1 || numericValue > 12 || !Number.isInteger(numericValue))) {
        problems.push('Input month must be an integer from 1 to 12');
      } else if (agent === 'market' && field === 'day_of_year' && (numericValue < 1 || numericValue > 366 || !Number.isInteger(numericValue))) {
        problems.push('Input day_of_year must be an integer from 1 to 366');
      }
    } else if (typeof value !== 'string' || !value.trim()) {
      problems.push(`Input ${field} must be a non-empty string`);
    }
  }
  if (agent === 'crop' && Number.isFinite(Number(input?.humidity)) && (Number(input.humidity) < 0 || Number(input.humidity) > 100)) {
    problems.push('Humidity must be between 0 and 100 percent');
  }
  if (agent === 'crop' && Number.isFinite(Number(input?.ph)) && (Number(input.ph) < 0 || Number(input.ph) > 14)) {
    problems.push('pH must be between 0 and 14');
  }
  if (agent === 'crop' && Number.isFinite(Number(input?.temperature)) && (Number(input.temperature) < -50 || Number(input.temperature) > 70)) {
    problems.push('Temperature must be between -50 and 70 °C');
  }
  if (agent === 'fertilizer' && typeof input?.Soil_Type === 'string' && !FERTILIZER_SOIL_TYPES.has(input.Soil_Type)) {
    problems.push('Input Soil_Type must be one of the supported model categories');
  }
  if (agent === 'fertilizer' && typeof input?.Season === 'string' && !FERTILIZER_SEASONS.has(input.Season)) {
    problems.push('Input Season must be Kharif, Rabi, or Zaid');
  }
  if (agent === 'fertilizer' && Number.isFinite(Number(input?.pH)) && (Number(input.pH) < 0 || Number(input.pH) > 14)) {
    problems.push('Soil pH must be between 0 and 14');
  }
  for (const field of fields.filter((name) => !NUMERIC_FIELDS[agent]?.has(name))) {
    if (typeof input[field] === 'string' && input[field].length > 120) {
      problems.push(`Input ${field} must be at most 120 characters`);
    }
  }
  return problems;
}

export function validateAgentInput(agent, input) {
  return inspectInput(agent, input);
}

export function reviewCropContext(input, context) {
  const farm = context?.farm && typeof context.farm === 'object' && !Array.isArray(context.farm)
    ? context.farm : {};
  const inputSources = context?.inputSources && typeof context.inputSources === 'object' && !Array.isArray(context.inputSources)
    ? context.inputSources : {};
  const sourceFor = (field) => CROP_SOURCE_LABELS[inputSources[field]] || 'source not recorded';
  const soilSourceField = { N: 'soilN', P: 'soilP', K: 'soilK', ph: 'soilPH' };
  const modelInputs = CROP_FIELDS.map((field) => ({
    field,
    value: Number.isFinite(Number(input?.[field])) ? Number(input[field]) : null,
    source: sourceFor(field),
    soilReadingSource: soilSourceField[field]
      ? CROP_SOURCE_LABELS[farm.soilSources?.[soilSourceField[field]]] || 'source not recorded'
      : undefined,
  }));
  const contextFields = [
    ['Location', farm.location],
    ['Season', farm.season],
    ['Soil type', farm.soilType],
    ['Water source', farm.waterSource],
    ['Water availability', farm.waterAvailability],
    ['Previous crop', farm.previousCrop],
  ].map(([field, value]) => ({ field, value: typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null }));
  const testDate = typeof farm.soilTestDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(farm.soilTestDate)
    ? farm.soilTestDate : null;

  return {
    modelInputs,
    farmContext: contextFields,
    soilTestDate: testDate,
    notes: [
      'The crop ranking uses the seven listed model inputs only; farm context is shown for review and does not change the ranking.',
      'The model score is not a calibrated probability of harvest success.',
      'Training-data geography and the rainfall reference period are undocumented; review the shortlist with local agricultural guidance.',
    ],
  };
}

function inspectResult(agent, result) {
  const problems = [];
  if (!result || typeof result !== 'object') return ['Agent returned no structured result'];

  if (agent === 'crop') {
    if (!result.prediction || !Array.isArray(result.recommendations)) {
      problems.push('Crop result is missing its prediction or ranked recommendations');
    } else {
      if (result.recommendations.length !== 3) problems.push('Crop result must contain exactly three ranked options');
      const names = result.recommendations.map(item => String(item?.crop || '').toLowerCase());
      if (names.some(name => !name) || new Set(names).size !== names.length) problems.push('Crop options must have non-empty, unique crop names');
      result.recommendations.forEach((item, index) => {
        if (item?.rank !== index + 1) problems.push('Crop options must be ranked in order from 1 to 3');
        if (!Number.isFinite(Number(item?.confidence)) || Number(item.confidence) < 0 || Number(item.confidence) > 100) {
          problems.push(`Crop option ${index + 1} has an invalid model score`);
        }
      });
      if (String(result.prediction).toLowerCase() !== names[0]) problems.push('Top crop prediction does not match the first ranked option');
    }
  }
  if (agent === 'fertilizer' && (!result.ratings || typeof result.ratings !== 'object')) {
    problems.push('Fertilizer result is missing nutrient ratings');
  }
  if (agent === 'fertilizer' && result.ratings && typeof result.ratings === 'object') {
    for (const nutrient of REQUIRED_NUTRIENTS) {
      if (!NUTRIENT_RATINGS.has(result.ratings[nutrient])) {
        problems.push(`Fertilizer result has a missing or invalid ${nutrient} rating`);
      }
    }
  }
  if (agent === 'market' && (!Number.isFinite(result.predicted_price) || result.predicted_price <= 0)) {
    problems.push('Market result has an invalid predicted price');
  }
  if (agent === 'rag' && !Array.isArray(result.results)) {
    problems.push('Knowledge retrieval result is missing its document list');
  } else if (agent === 'rag') {
    if (result.results.length > 10) problems.push('Knowledge retrieval returned too many documents');
    result.results.forEach((source, index) => {
      const label = `Retrieved source ${index + 1}`;
      if (!source || typeof source !== 'object' || !source.title || !source.publisher || !source.text) {
        problems.push(`${label} is missing its title, publisher, or excerpt`);
        return;
      }
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:' || !(url.hostname.endsWith('.gov.in') || url.hostname.endsWith('.nic.in'))) {
          problems.push(`${label} must link to an official HTTPS government source`);
        }
      } catch {
        problems.push(`${label} has an invalid source URL`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checkedDate || '')) problems.push(`${label} is missing its source review date`);
      if (!Number.isFinite(source.score) || source.score < 0 || source.score > 1) problems.push(`${label} has an invalid retrieval score`);
    });
  }
  return problems;
}

export function validateAgentRun(agentRuns) {
  const checks = Object.entries(agentRuns).map(([agent, run]) => {
    if (run.error) {
      return {
        agent,
        status: 'failed',
        issues: [run.error],
        checked: ['agent service response'],
      };
    }
    const inputProblems = inspectInput(agent, run.input);
    const resultProblems = inspectResult(agent, run.result);
    const issues = run.preflightIssues || [...inputProblems, ...resultProblems];
    return {
      agent,
      status: issues.length ? 'needs_review' : 'passed',
      issues,
      checked: ['required inputs', 'structured output shape', 'basic value constraints'],
    };
  });

  return {
    status: checks.some((check) => check.status === 'needs_review')
      ? 'needs_review'
      : checks.some((check) => check.status === 'failed') ? 'failed' : 'passed',
    checks,
    limitations: [
      'Validation checks completeness and basic consistency; it does not prove agronomic correctness.',
      'Disease photo screening is a separate image workflow and is not run by the farm-profile assessment.',
    ],
  };
}

export function enforceAgentValidation(agentRuns, validation) {
  const checks = new Map(validation.checks.map((check) => [check.agent, check]));
  return Object.fromEntries(Object.entries(agentRuns).map(([agent, run]) => {
    if (run.error) return [agent, run];
    const check = checks.get(agent);
    if (check?.status === 'passed') return [agent, run];
    const issues = check?.issues || ['Validation did not produce a passing result'];
    return [agent, {
      input: run.input,
      error: `Validation needs review: ${issues.join('; ')}`,
      preflightIssues: issues,
    }];
  }));
}
