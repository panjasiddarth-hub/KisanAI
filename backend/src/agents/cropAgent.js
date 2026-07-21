// src/agents/cropAgent.js — Crop Suggester: soil + pH + season + water → ranked crops
import { CROPS, SOIL_TYPES, SEASONS } from '../data/crops.js';

function scoreCrop(crop, input) {
  const reasons = [];
  let score = 0;

  // 1. Soil match (35)
  if (crop.soils.includes(input.soilType)) {
    score += 35;
    reasons.push(`Thrives in ${label(input.soilType)} soil`);
  } else {
    reasons.push(`Not ideal for ${label(input.soilType)} soil`);
  }

  // 2. pH fit (20)
  const [lo, hi] = crop.ph;
  if (input.ph >= lo && input.ph <= hi) {
    score += 20;
    reasons.push(`Your pH ${input.ph} is inside its optimal range (${lo}–${hi})`);
  } else {
    const dist = input.ph < lo ? lo - input.ph : input.ph - hi;
    score += Math.max(0, 14 - dist * 14);
    reasons.push(`pH ${input.ph} is outside its best range (${lo}–${hi})`);
  }

  // 3. Season fit (30)
  if (crop.seasons.includes(input.season)) {
    score += 30;
    reasons.push(`Correct season — sown in ${label(input.season)}`);
  } else {
    reasons.push(`Normally grown in ${crop.seasons.map(label).join('/')}, not ${label(input.season)}`);
  }

  // 4. Water availability (15)
  const need = { low: 1, medium: 2, high: 3 }[crop.water];
  if (input.irrigation === 'irrigated') {
    score += 15;
    reasons.push(need === 3 ? 'Needs assured irrigation — you have it' : 'Water need easily met with irrigation');
  } else {
    if (need === 1) { score += 15; reasons.push('Survives well on rainfall (drought-hardy)'); }
    else if (need === 2) { score += 6; reasons.push('Moderate water need — risky under pure rainfed'); }
    else { score -= 15; reasons.push('High water need — avoid without irrigation'); }
  }

  return { score: Math.round(Math.max(0, Math.min(100, score))), reasons };
}

const label = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function suggestCrops({ soilType, ph = 7.0, season, irrigation = 'irrigated' }) {
  const errors = [];
  if (!SOIL_TYPES.includes(soilType)) errors.push(`soilType must be one of: ${SOIL_TYPES.join(', ')}`);
  if (!SEASONS.includes(season)) errors.push(`season must be one of: ${SEASONS.join(', ')}`);
  if (!(ph >= 4 && ph <= 9.5)) errors.push('ph must be between 4 and 9.5');
  if (!['irrigated', 'rainfed'].includes(irrigation)) errors.push("irrigation must be 'irrigated' or 'rainfed'");
  if (errors.length) return { error: errors.join('; ') };

  const input = { soilType, ph: Number(ph), season, irrigation };
  const ranked = CROPS
    .map(c => ({ crop: c.name, ...scoreCrop(c, input), waterNeed: c.water, durationDays: c.duration, hint: c.hint }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return { input, recommendations: ranked };
}

export function templateExplanation({ input, recommendations }) {
  const top = recommendations[0];
  return (
    `For your ${input.soilType} soil (pH ${input.ph}) in the ${input.season} season with ${input.irrigation} conditions, ` +
    `${top.crop} is the strongest choice (suitability ${top.score}%). ` +
    `${recommendations[1] ? `${recommendations[1].crop} and ${recommendations[2]?.crop || ''} are solid backups. ` : ''}` +
    `${top.hint} Plan sowing within the recommended window and match fertilizer to the crop's duration (${top.durationDays[0]}–${top.durationDays[1]} days).`
  );
}
