const SOIL_FIELDS = [
  ['soilPH', 'Soil pH'],
  ['soilEC', 'Electrical conductivity'],
  ['soilOC', 'Organic carbon'],
  ['soilN', 'Nitrogen (N)'],
  ['soilP', 'Phosphorus (P)'],
  ['soilK', 'Potassium (K)'],
  ['soilS', 'Sulphur (S)'],
  ['soilZn', 'Zinc (Zn)'],
  ['soilB', 'Boron (B)'],
  ['soilFe', 'Iron (Fe)'],
  ['soilCu', 'Copper (Cu)'],
  ['soilMn', 'Manganese (Mn)'],
];
const SUPPORTED_SOIL_TYPES = new Set(['Black Cotton', 'Alluvial']);
const SUPPORTED_SEASONS = new Set(['Kharif', 'Rabi', 'Zaid']);

export function getFarmAssessmentReadiness(farm) {
  if (!farm) return { complete: 0, total: SOIL_FIELDS.length + 2, missing: SOIL_FIELDS.map(([, label]) => label).concat(['Supported soil type', 'Growing season']) };
  const missing = SOIL_FIELDS
    .filter(([field]) => farm[field] === null || farm[field] === undefined || farm[field] === '' || !Number.isFinite(Number(farm[field])))
    .map(([, label]) => label);
  if (!SUPPORTED_SOIL_TYPES.has(farm.soilType)) missing.push('Supported soil type (Black Cotton or Alluvial)');
  if (!SUPPORTED_SEASONS.has(farm.season)) missing.push('Growing season (Kharif, Rabi, or Zaid)');
  return { complete: SOIL_FIELDS.length + 2 - missing.length, total: SOIL_FIELDS.length + 2, missing };
}
