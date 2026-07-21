// src/data/diseases.js — symptom-signature knowledge base for the Disease agent

export const SYMPTOMS = [
  { id: 'yellowing', label: 'Yellowing of leaves' },
  { id: 'brown_spots', label: 'Brown / black spots' },
  { id: 'powdery_white', label: 'White powdery coating' },
  { id: 'wilting', label: 'Wilting / drooping' },
  { id: 'holes', label: 'Holes in leaves / bolls' },
  { id: 'curling', label: 'Leaf curling / cupping' },
  { id: 'rust_pustules', label: 'Rust-coloured pustules' },
  { id: 'black_rot', label: 'Blackening / rot' },
  { id: 'stunting', label: 'Stunted growth' },
  { id: 'mosaic', label: 'Mosaic / mottled pattern' },
  { id: 'leaf_blight', label: 'Blight (rapid drying)' },
  { id: 'boll_damage', label: 'Damaged bolls / fruits' },
  { id: 'water_soaked', label: 'Water-soaked lesions' },
  { id: 'premature_drop', label: 'Premature dropping' },
  { id: 'silver_streaks', label: 'Silvery streaks' },
];

export const DISEASE_DB = {
  cotton: [
    { name: 'Pink Bollworm', pathogen: 'Pest (Pectinophora gossypiella)', symptoms: ['holes', 'boll_damage', 'premature_drop'],
      treatment: { chemical: 'Spray Profenophos 50% EC @ 2 ml/L or Emamectin benzoate 5% SG @ 0.4 g/L at boll formation.', organic: 'Install pheromone traps @ 5/acre; release Trichogramma wasps; remove and destroy infested bolls.' },
      prevention: ['Avoid late sowing', 'Deep summer ploughing', 'Grow non-Bt refuge crop (20%)'] },
    { name: 'Cotton Leaf Curl Virus (CLCuV)', pathogen: 'Virus (whitefly-vector)', symptoms: ['curling', 'yellowing', 'stunting'],
      treatment: { chemical: 'No direct cure — control vector: Imidacloprid 17.8% SL @ 0.3 ml/L against whitefly.', organic: 'Neem oil 5 ml/L every 10 days; yellow sticky traps @ 8/acre; uproot infected plants.' },
      prevention: ['Grow resistant varieties (e.g. LH 2075)', 'Early sowing', 'Keep field weed-free'] },
    { name: 'Alternaria Leaf Spot', pathogen: 'Fungus (Alternaria macrospora)', symptoms: ['brown_spots', 'leaf_blight', 'premature_drop'],
      treatment: { chemical: 'Mancozeb 75% WP @ 2.5 g/L or Copper oxychloride 50% WP @ 3 g/L, 2 sprays 15 days apart.', organic: 'Spray garlic-chilli extract; Pseudomonas fluorescens @ 10 g/kg seed treatment.' },
      prevention: ['Use disease-free seed', 'Balanced potash', 'Avoid dense planting'] },
    { name: 'Fusarium Wilt', pathogen: 'Fungus (Fusarium oxysporum)', symptoms: ['wilting', 'yellowing', 'premature_drop'],
      treatment: { chemical: 'Soil drench Carbendazim 50% WP @ 1 g/L around affected plants.', organic: 'Trichoderma viride-enriched FYM; solarise nursery soil.' },
      prevention: ['Crop rotation with cereals', 'Resistant varieties', 'Well-drained soil'] },
  ],
  tomato: [
    { name: 'Early Blight', pathogen: 'Fungus (Alternaria solani)', symptoms: ['brown_spots', 'leaf_blight', 'yellowing'],
      treatment: { chemical: 'Mancozeb 75% WP @ 2.5 g/L or Chlorothalonil @ 2 ml/L every 10–12 days.', organic: 'Bordeaux mixture 1%; remove lower infected leaves.' },
      prevention: ['Stake plants for airflow', 'Mulch to avoid soil splash', 'Rotate with non-solanaceous crops'] },
    { name: 'Tomato Leaf Curl Virus (ToLCV)', pathogen: 'Virus (whitefly-vector)', symptoms: ['curling', 'yellowing', 'mosaic', 'stunting'],
      treatment: { chemical: 'Control whitefly: Diafenthiuron 50% WP @ 1 g/L or Imidacloprid @ 0.3 ml/L.', organic: 'Neem seed kernel extract 5%; silver mulch to repel whitefly; remove infected plants early.' },
      prevention: ['Virus-tolerant hybrids (Arka Rakshak)', 'Nursery under insect net', 'Avoid tomato near chilli fields'] },
    { name: 'Late Blight', pathogen: 'Oomycete (Phytophthora infestans)', symptoms: ['water_soaked', 'leaf_blight', 'black_rot'],
      treatment: { chemical: 'Metalaxyl 8% + Mancozeb 64% WP @ 2.5 g/L immediately at first sign; repeat 7 days.', organic: 'Copper hydroxide spray; improve drainage, avoid overhead irrigation.' },
      prevention: ['Certified seed', 'Avoid cool wet conditions', 'Destroy crop residues'] },
  ],
  wheat: [
    { name: 'Brown / Yellow Rust', pathogen: 'Fungus (Puccinia spp.)', symptoms: ['rust_pustules', 'yellowing'],
      treatment: { chemical: 'Propiconazole 25% EC @ 1 ml/L at first pustule sighting; repeat after 15 days if needed.', organic: 'Sulphur dust @ 10 kg/acre (only if temp < 25°C).' },
      prevention: ['Grow resistant varieties (HD-2967, DBW-187)', 'Timely sowing', 'Avoid excess nitrogen'] },
    { name: 'Powdery Mildew', pathogen: 'Fungus (Blumeria graminis)', symptoms: ['powdery_white', 'yellowing', 'stunting'],
      treatment: { chemical: 'Hexaconazole 5% EC @ 2 ml/L or Wettable sulphur @ 2.5 g/L.', organic: 'Spray diluted cow milk (1:10) weekly; potassium bicarbonate solution.' },
      prevention: ['Balanced N (excess N worsens it)', 'Open canopy', 'Resistant varieties'] },
    { name: 'Leaf Blight (Bipolaris)', pathogen: 'Fungus', symptoms: ['leaf_blight', 'brown_spots'],
      treatment: { chemical: 'Mancozeb @ 2.5 g/L or Zineb @ 2 g/L at tillering and flag-leaf stage.', organic: 'Trichoderma seed treatment @ 4 g/kg.' },
      prevention: ['Seed treatment', 'Timely sowing', 'Avoid water stress at grain fill'] },
  ],
  onion: [
    { name: 'Purple Blotch', pathogen: 'Fungus (Alternaria porri)', symptoms: ['brown_spots', 'leaf_blight', 'water_soaked'],
      treatment: { chemical: 'Mancozeb @ 2.5 g/L + spreader; alternate with Copper oxychloride @ 3 g/L.', organic: 'Trichoderma foliar spray; avoid sprinkler irrigation in evening.' },
      prevention: ['Crop rotation', 'Well-drained beds', 'Disease-free bulbs'] },
    { name: 'Thrips', pathogen: 'Pest (Thrips tabaci)', symptoms: ['silver_streaks', 'curling', 'stunting'],
      treatment: { chemical: 'Fipronil 5% SC @ 1 ml/L or Spinosad @ 0.3 ml/L in evening.', organic: 'Blue sticky traps @ 10/acre; neem oil 5 ml/L; sprinkle fine sand between rows.' },
      prevention: ['Sprinkler irrigation (thrips hate moisture)', 'Avoid excess N', 'Remove crop debris'] },
  ],
  paddy: [
    { name: 'Rice Blast', pathogen: 'Fungus (Magnaporthe oryzae)', symptoms: ['brown_spots', 'leaf_blight'],
      treatment: { chemical: 'Tricyclazole 75% WP @ 0.6 g/L or Isoprothiolane @ 1.5 ml/L at booting.', organic: 'Pseudomonas fluorescens spray; silicon-rich amendments (rice husk ash).' },
      prevention: ['Resistant varieties', 'Avoid excess urea', 'Proper spacing'] },
    { name: 'Bacterial Leaf Blight', pathogen: 'Bacteria (Xanthomonas oryzae)', symptoms: ['water_soaked', 'yellowing', 'leaf_blight'],
      treatment: { chemical: 'Streptocycline 0.15 g/L + Copper oxychloride 3 g/L, 2 sprays 12 days apart.', organic: 'Fresh cow-dung extract (20 g/L) spray; avoid field-to-field water flow.' },
      prevention: ['Certified seed', 'Balanced N', 'Drain field periodically'] },
    { name: 'Yellow Stem Borer', pathogen: 'Pest (Scirpophaga incertulas)', symptoms: ['holes', 'stunting', 'wilting'],
      treatment: { chemical: 'Chlorantraniliprole 18.5% SC @ 0.3 ml/L or Cartap hydrochloride granules @ 8 kg/acre.', organic: 'Pheromone traps @ 4/acre; clip seedling leaf tips before transplanting.' },
      prevention: ['Destroy stubble after harvest', 'Light traps', 'Egg-mass collection'] },
  ],
  soybean: [
    { name: 'Yellow Mosaic Virus', pathogen: 'Virus (whitefly-vector)', symptoms: ['mosaic', 'yellowing', 'curling'],
      treatment: { chemical: 'Vector control: Thiamethoxam 25% WG @ 0.2 g/L.', organic: 'Neem oil + yellow sticky traps; rogue infected plants before pod set.' },
      prevention: ['Resistant varieties (JS-335, NRC-37)', 'Early sowing', 'Border crop of maize/sorghum'] },
    { name: 'Soybean Rust', pathogen: 'Fungus (Phakopsora pachyrhizi)', symptoms: ['rust_pustules', 'brown_spots', 'premature_drop'],
      treatment: { chemical: 'Hexaconazole @ 2 ml/L or Propiconazole @ 1 ml/L, two sprays 15 days apart.', organic: 'Sulphur WDG @ 2.5 g/L.' },
      prevention: ['Monitor from flowering', 'Avoid dense canopy', 'Resistant varieties'] },
  ],
  sugarcane: [
    { name: 'Red Rot', pathogen: 'Fungus (Colletotrichum falcatum)', symptoms: ['black_rot', 'wilting', 'yellowing'],
      treatment: { chemical: 'Sett treatment: Carbendazim @ 1 g/L for 30 min before planting. Foliar: Propiconazole @ 1 ml/L.', organic: 'Trichoderma sett treatment; remove and burn clumps showing red rot.' },
      prevention: ['Disease-free 3-bud setts', 'Resistant varieties (Co-86032)', 'Avoid ratooning infected fields'] },
    { name: 'Early Shoot Borer', pathogen: 'Pest (Chilo infuscatellus)', symptoms: ['holes', 'stunting', 'premature_drop'],
      treatment: { chemical: 'Chlorantraniliprole granules @ 4 kg/acre in soil at 30–45 DAP.', organic: 'Release Trichogramma chilonis @ 20,000/acre every 10 days.' },
      prevention: ['Trash mulching', 'Light traps', 'Avoid waterlogging'] },
  ],
};

export function cropKey(name = '') {
  const n = name.toLowerCase();
  if (n.includes('paddy') || n.includes('rice')) return 'paddy';
  for (const k of Object.keys(DISEASE_DB)) if (n.includes(k)) return k;
  return null;
}
