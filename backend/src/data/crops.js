// src/data/crops.js — agronomy knowledge base for the Crop Suggester agent
// water: 'low' (rainfed-friendly) | 'medium' | 'high' (needs assured irrigation)
export const SOIL_TYPES = ['black', 'red', 'alluvial', 'loamy', 'sandy', 'clay', 'laterite'];
export const SEASONS = ['kharif', 'rabi', 'zaid'];

export const CROPS = [
  { name: 'Cotton', seasons: ['kharif'], soils: ['black', 'loamy', 'sandy'], ph: [6.0, 8.0], water: 'medium', duration: [150, 180], hint: 'Telangana black-soil belt staple; strong mandi demand.' },
  { name: 'Soybean', seasons: ['kharif'], soils: ['black', 'loamy'], ph: [6.0, 7.5], water: 'medium', duration: [90, 120], hint: 'Good protein-rich rotation after cotton.' },
  { name: 'Paddy (Rice)', seasons: ['kharif'], soils: ['clay', 'alluvial', 'loamy'], ph: [5.5, 7.0], water: 'high', duration: [120, 150], hint: 'Needs standing water — only with assured irrigation.' },
  { name: 'Wheat', seasons: ['rabi'], soils: ['alluvial', 'loamy', 'clay'], ph: [6.0, 7.5], water: 'medium', duration: [110, 130], hint: 'Classic rabi cereal; HD-2967 suited for Telangana.' },
  { name: 'Maize', seasons: ['kharif', 'rabi'], soils: ['loamy', 'alluvial', 'red'], ph: [5.5, 7.5], water: 'medium', duration: [90, 110], hint: 'Dual-season; strong poultry-feed demand locally.' },
  { name: 'Sugarcane', seasons: ['kharif', 'zaid'], soils: ['black', 'alluvial', 'loamy'], ph: [6.0, 8.0], water: 'high', duration: [300, 365], hint: 'Year-long crop; needs assured irrigation and labour.' },
  { name: 'Onion', seasons: ['rabi'], soils: ['loamy', 'alluvial', 'red'], ph: [6.0, 7.5], water: 'medium', duration: [110, 130], hint: 'High cash value; watch thrips in Feb–Mar.' },
  { name: 'Tomato', seasons: ['rabi', 'zaid'], soils: ['loamy', 'red', 'alluvial'], ph: [6.0, 7.0], water: 'medium', duration: [90, 120], hint: 'Quick returns; stagger planting for price spread.' },
  { name: 'Chickpea (Chana)', seasons: ['rabi'], soils: ['black', 'loamy', 'sandy'], ph: [6.0, 8.0], water: 'low', duration: [95, 110], hint: 'Grows on residual moisture after kharif harvest.' },
  { name: 'Pigeonpea (Tur)', seasons: ['kharif'], soils: ['black', 'red', 'loamy'], ph: [6.0, 7.5], water: 'low', duration: [150, 180], hint: 'Drought-hardy pulse, good intercrop with soybean.' },
  { name: 'Groundnut', seasons: ['kharif'], soils: ['sandy', 'red', 'loamy'], ph: [6.0, 7.0], water: 'low', duration: [100, 120], hint: 'Loves light soils; gypsum at flowering boosts pods.' },
  { name: 'Mustard', seasons: ['rabi'], soils: ['alluvial', 'loamy'], ph: [6.0, 7.5], water: 'low', duration: [100, 120], hint: 'Low water need; suits rainfed rabi slots.' },
  { name: 'Jowar (Sorghum)', seasons: ['kharif', 'rabi'], soils: ['black', 'loamy'], ph: [6.0, 8.0], water: 'low', duration: [100, 120], hint: 'Traditional Telangana millet; very forgiving.' },
  { name: 'Bajra (Pearl Millet)', seasons: ['kharif'], soils: ['sandy', 'red', 'loamy'], ph: [6.0, 7.5], water: 'low', duration: [70, 90], hint: 'Fastest cereal; survives harsh dry spells.' },
  { name: 'Potato', seasons: ['rabi'], soils: ['alluvial', 'loamy', 'sandy'], ph: [5.5, 6.5], water: 'medium', duration: [80, 100], hint: 'Prefers slightly acidic soil; cool-season only.' },
  { name: 'Turmeric', seasons: ['kharif'], soils: ['red', 'loamy', 'alluvial'], ph: [5.5, 7.0], water: 'medium', duration: [210, 240], hint: 'Telangana (Nizamabad) turmeric belt — high value.' },
  { name: 'Sunflower', seasons: ['rabi', 'zaid'], soils: ['black', 'loamy', 'red'], ph: [6.5, 8.0], water: 'low', duration: [85, 100], hint: 'Short-duration oilseed; tolerant of light stress.' },
  { name: 'Banana', seasons: ['kharif', 'rabi', 'zaid'], soils: ['loamy', 'alluvial', 'black'], ph: [6.0, 7.5], water: 'high', duration: [300, 365], hint: 'High returns but needs drip + wind shelter.' },
];
