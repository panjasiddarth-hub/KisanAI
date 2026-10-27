const SOIL_FIELD_MAP = {
  pH: 'soilPH',
  EC_dS_per_m: 'soilEC',
  OC_percent: 'soilOC',
  N_kg_per_ha: 'soilN',
  P_kg_per_ha: 'soilP',
  K_kg_per_ha: 'soilK',
  S_ppm: 'soilS',
  Zn_ppm: 'soilZn',
  B_ppm: 'soilB',
  Fe_ppm: 'soilFe',
  Cu_ppm: 'soilCu',
  Mn_ppm: 'soilMn',
};

const SOIL_TYPE_MAP = {
  'Black Cotton': 'Black (Regur)',
  Alluvial: 'Alluvial',
};

const CROP_INPUT_FIELDS = {
  N: 'soilN',
  P: 'soilP',
  K: 'soilK',
  ph: 'soilPH',
  temperature: 'temperature',
  humidity: 'humidity',
  rainfall: 'rainfall',
};

const SOIL_SOURCE_LABELS = {
  soil_report_reviewed: 'farmer-reviewed soil report',
  farmer_entered: 'entered by farmer',
  farm_profile_source_unknown: 'saved farm value; source not recorded',
  not_recorded: 'source not recorded',
};

function sourceLabel(source) {
  return SOIL_SOURCE_LABELS[source] || 'source not recorded';
}

function missingValues(input, fields) {
  return fields.filter((field) => input[field] === undefined || input[field] === null || input[field] === '');
}

export function buildFarmAgentPlan(farm, { agents = ['crop', 'fertilizer'], environment = {}, market } = {}) {
  const inputs = {};
  const needsInput = {};
  const inputSources = {};

  if (agents.includes('crop')) {
    const cropInput = {};
    for (const [modelField, farmOrEnvironmentField] of Object.entries(CROP_INPUT_FIELDS)) {
      if (farmOrEnvironmentField === 'temperature' || farmOrEnvironmentField === 'humidity' || farmOrEnvironmentField === 'rainfall') {
        const value = environment[farmOrEnvironmentField];
        if (value !== undefined && value !== null && value !== '') cropInput[modelField] = Number(value);
        inputSources[modelField] = environment.inputSources?.[farmOrEnvironmentField] || 'not_recorded';
      } else {
        const value = farm[farmOrEnvironmentField];
        if (value !== undefined && value !== null && value !== '') cropInput[modelField] = Number(value);
        inputSources[modelField] = farm.soilSources?.[farmOrEnvironmentField] || 'farm_profile_source_unknown';
      }
    }
    const missing = missingValues(cropInput, Object.keys(CROP_INPUT_FIELDS));
    if (missing.length) {
      needsInput.crop = {
        missingInputs: missing,
        message: 'Add the missing soil or weather readings. KisanAI will not guess model inputs.',
      };
    } else {
      inputs.crop = cropInput;
    }
  }

  if (agents.includes('fertilizer')) {
    const fertilizerInput = Object.fromEntries(
      Object.entries(SOIL_FIELD_MAP).map(([modelField, farmField]) => [modelField, farm[farmField]]),
    );
    fertilizerInput.Soil_Type = SOIL_TYPE_MAP[farm.soilType] || '';
    fertilizerInput.Season = farm.season || '';
    for (const [modelField, farmField] of Object.entries(SOIL_FIELD_MAP)) {
      inputSources[modelField] = sourceLabel(farm.soilSources?.[farmField]);
    }
    inputSources.Soil_Type = 'farm_profile';
    inputSources.Season = 'farm_profile';
    const required = [...Object.keys(SOIL_FIELD_MAP), 'Soil_Type', 'Season'];
    const missing = missingValues(fertilizerInput, required);
    if (missing.length) {
      needsInput.fertilizer = {
        missingInputs: missing,
        message: 'The soil model needs every listed report value and a supported soil type and season. Missing readings are not estimated.',
      };
    } else {
      inputs.fertilizer = Object.fromEntries(
        Object.entries(fertilizerInput).map(([field, value]) => [
          field,
          typeof value === 'number' || field === 'Soil_Type' || field === 'Season' ? value : Number(value),
        ]),
      );
    }
  }

  if (agents.includes('market')) {
    if (market && typeof market === 'object' && !Array.isArray(market)) {
      inputs.market = market;
    } else {
      needsInput.market = {
        missingInputs: ['verified recent mandi price history'],
        message: 'The saved farm does not contain the verified price history required by the market model. No sample prices are substituted.',
      };
    }
  }

  return {
    inputs,
    needsInput,
    inputSources,
    farmContext: {
      id: farm.id,
      name: farm.name,
      location: farm.location,
      district: farm.district || null,
      state: farm.state || null,
      area: farm.area !== null && farm.area !== undefined && Number.isFinite(Number(farm.area)) ? Number(farm.area) : null,
      areaUnit: farm.areaUnit || null,
      soilType: farm.soilType || null,
      season: farm.season || null,
      crops: Array.isArray(farm.crops) ? farm.crops : [],
      previousCrop: farm.previousCrop || null,
      waterSource: farm.waterSource || null,
      waterAvailability: farm.waterAvailability || null,
      soilTestDate: farm.soilTestDate || null,
      soilSources: Object.fromEntries(
        Object.entries(farm.soilSources || {}).map(([field, source]) => [field, sourceLabel(source)]),
      ),
    },
  };
}
