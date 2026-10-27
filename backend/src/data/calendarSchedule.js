// Calendar timing only. These offsets are planning defaults, not model predictions.
const CROP_SPLITS = {
  cotton: [['Basal (at sowing)', 0], ['Vegetative (30 DAS)', 30], ['Square formation (65 DAS)', 65]],
  soybean: [['Basal (at sowing)', 0]],
  paddy: [['Basal', 0], ['Active tillering (25 DAT)', 25], ['Panicle initiation (45 DAT)', 45]],
  wheat: [['Basal (at sowing)', 0], ['Crown root initiation (21 DAS)', 21], ['Tillering (45 DAS)', 45]],
  maize: [['Basal', 0], ['Knee-high (25 DAS)', 25], ['Tasseling (45 DAS)', 45]],
  onion: [['Basal (transplant)', 0], ['Bulb initiation (30 DAT)', 30], ['Bulb development (50 DAT)', 50]],
  tomato: [['Basal (transplant)', 0], ['First flowering (25 DAT)', 25], ['Fruit set (45 DAT)', 45]],
  sugarcane: [['Basal (planting)', 0], ['Tillering (45 DAP)', 45], ['Grand growth (90 DAP)', 90]],
  chickpea: [['Basal (at sowing)', 0]],
  groundnut: [['Basal', 0]],
  potato: [['Basal', 0], ['Earthing up (30 DAP)', 30]],
  mustard: [['Basal', 0], ['Vegetative (25 DAS)', 25]],
};

export function cropCalendarSchedule(cropName = '') {
  const key = Object.keys(CROP_SPLITS).find((name) => cropName.toLowerCase().includes(name));
  return CROP_SPLITS[key || 'wheat'];
}
