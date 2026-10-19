// src/services/farmIrrigation.js — weather-based irrigation advice for a saved farm.
//
// The farm's confirmed coordinates → Open-Meteo daily rain, rain probability and FAO-56 reference
// evapotranspiration (ET0) for the last 2 days (model estimate) and the next 7 days (forecast)
//   + the farm's calendar (crop, sowing date, irrigation events)
//   → crop water use (ETc = Kc × ET0, FAO-56 single crop coefficient) for the coming week
//   → for each upcoming irrigation event, the calendar's own rule: skip if more than 25 mm of
//     rain in the 48 hours before.
// Soil moisture is not measured anywhere in KisanAI, so nothing here claims to know it.

import { CROPS } from '../data/crops.js';
import { fetchWaterBalance } from './openMeteo.js';
import { activePlanForFarm, addDays, daysBetween, farmAreaAcres } from './farmContext.js';

const RULE_MM = 25; // calendar.routes.js irrigation events: "Skip if >25 mm rain in last 48h."
const LITRES_PER_MM_PER_ACRE = 4046.86; // 1 mm of water over 1 acre (4,046.86 m²)
const FAO56_URL = 'https://www.fao.org/4/x0490e/x0490e0b.htm';
const norm = (s) => String(s || '').trim().toLowerCase();
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

// FAO Irrigation and Drainage Paper 56, Chapter 6: Kc ini / Kc mid / Kc end from Table 12 and
// stage lengths (initial, development, mid-season, late) from Table 11. Stage lengths are scaled
// to the crop duration KisanAI's calendar uses. Where FAO gives a range, the midpoint is used.
// No FAO-56 values for Mustard or Turmeric, so they get reference ET0 only.
const FAO56 = {
  Cotton: { kc: [0.35, 1.175, 0.6], stages: [30, 50, 60, 55], ref: 'Table 12 Cotton (Kc mid 1.15–1.20, Kc end 0.70–0.50 → midpoints); Table 11 Cotton, Mar–May, Egypt/Pakistan' },
  Soybean: { kc: [0.4, 1.15, 0.5], stages: [15, 15, 40, 15], ref: 'Table 12 Soybeans (Kc ini = legume group 0.4); Table 11 Soybeans, Dec, Tropics' },
  'Paddy (Rice)': { kc: [1.05, 1.2, 0.75], stages: [30, 30, 60, 30], ref: 'Table 12 Rice (Kc end 0.90–0.60 → midpoint); Table 11 Rice, Dec/May, Tropics' },
  Wheat: { kc: [0.3, 1.15, 0.325], stages: [15, 25, 50, 30], ref: 'Table 12 Spring Wheat (Kc ini = cereal group 0.3, Kc end 0.25–0.40 → midpoint); Table 11 Wheat, November, Central India' },
  Maize: { kc: [0.3, 1.2, 0.475], stages: [20, 35, 40, 30], ref: 'Table 12 Maize, field grain (Kc ini = cereal group 0.3, Kc end 0.60–0.35 → midpoint); Table 11 Maize (grain), October, India' },
  Sugarcane: { kc: [0.4, 1.25, 0.75], stages: [35, 60, 190, 120], ref: 'Table 12 Sugar Cane; Table 11 Sugarcane, virgin, low latitudes' },
  Onion: { kc: [0.7, 1.05, 0.75], stages: [15, 25, 70, 40], ref: 'Table 12 Onions, dry (Kc ini = small-vegetable group 0.7); Table 11 Onion (dry), April, Mediterranean' },
  Tomato: { kc: [0.6, 1.15, 0.8], stages: [30, 40, 40, 25], ref: 'Table 12 Tomato (Kc ini = Solanum group 0.6, Kc end 0.70–0.90 → midpoint); Table 11 Tomato, January, arid region' },
  'Chickpea (Chana)': { kc: [0.4, 1.0, 0.35], stages: [20, 30, 40, 20], ref: "Table 12 Chick pea (Kc ini = legume group 0.4); Table 11 has no chickpea row — 'Beans (dry)' stage lengths used" },
  'Pigeonpea (Tur)': { kc: [0.4, 1.15, 0.35], stages: [20, 30, 40, 20], ref: "Table 12 'Beans, dry and Pulses' (no pigeonpea row); Table 11 'Beans (dry)' stage lengths" },
  Groundnut: { kc: [0.4, 1.15, 0.6], stages: [25, 35, 45, 25], ref: 'Table 12 Groundnut (Kc ini = legume group 0.4); Table 11 Groundnut, dry season, West Africa' },
  'Jowar (Sorghum)': { kc: [0.3, 1.05, 0.55], stages: [20, 35, 40, 30], ref: 'Table 12 Sorghum, grain (Kc ini = cereal group 0.3, Kc mid 1.00–1.10 → midpoint); Table 11 Sorghum, May/June' },
  'Bajra (Pearl Millet)': { kc: [0.3, 1.0, 0.3], stages: [15, 25, 40, 25], ref: 'Table 12 Millet (Kc ini = cereal group 0.3); Table 11 Millet, June, Pakistan' },
  Potato: { kc: [0.5, 1.15, 0.75], stages: [25, 30, 45, 30], ref: 'Table 12 Potato (Kc ini = roots & tubers group 0.5); Table 11 Potato, November, (semi-)arid' },
  Sunflower: { kc: [0.35, 1.075, 0.35], stages: [25, 35, 45, 25], ref: 'Table 12 Sunflower (Kc mid 1.0–1.15 → midpoint); Table 11 Sunflower, April/May' },
  Banana: { kc: [0.5, 1.1, 1.0], stages: [120, 90, 120, 60], ref: 'Table 12 Banana, 1st year; Table 11 Banana, 1st year' },
};

// FAO-56 Kc curve: flat initial stage, linear rise through development, flat mid-season,
// linear fall through the late season. Returns null before sowing / after the crop duration.
function kcOn(das, stageDays, [kcIni, kcMid, kcEnd]) {
  if (das < 0) return null;
  const [l1, l2, l3, l4] = stageDays;
  if (das <= l1) return { kc: kcIni, stage: 'initial' };
  if (das <= l1 + l2) return { kc: kcIni + ((das - l1) / l2) * (kcMid - kcIni), stage: 'development' };
  if (das <= l1 + l2 + l3) return { kc: kcMid, stage: 'mid-season' };
  if (das <= l1 + l2 + l3 + l4) return { kc: kcMid + ((das - l1 - l2 - l3) / l4) * (kcEnd - kcMid), stage: 'late season' };
  return null;
}

// plan: optional explicit calendar (see fertilizerPlanForFarm). Omitted → the farm's active plan.
export async function irrigationForFarm({ userId, farm, plan: planOverride }) {
  const { lat, lon } = farm.coordinates;
  const wb = await fetchWaterBalance(lat, lon, { pastDays: 2, forecastDays: 7 });
  const plan = planOverride !== undefined ? planOverride : await activePlanForFarm(userId, farm);
  const acres = farmAreaAcres(farm);
  const missing = [];
  const limitations = [];

  // ---- Crop context: the farm's calendar, else its selected crop ----
  const sel = farm.selectedCrop;
  const source = plan
    ? { name: plan.crop, sowingDate: plan.sowingDate, planId: plan.id, from: 'calendar' }
    : sel?.calendarCrop && sel?.sowingDate
      ? { name: sel.calendarCrop, sowingDate: sel.sowingDate, planId: null, from: 'selected crop (calendar not generated yet)' }
      : null;
  let crop = null;
  let fao = null;
  if (source) {
    const meta = CROPS.find((c) => norm(c.name) === norm(source.name));
    fao = meta ? FAO56[meta.name] : null;
    const duration = meta?.duration?.[0] || null;
    const das = daysBetween(source.sowingDate, wb.today);
    crop = { ...source, das, durationDays: duration, kcSource: fao ? `FAO-56 ${fao.ref}` : null };
    if (fao && duration) {
      const total = fao.stages.reduce((a, b) => a + b, 0);
      crop.stageDays = fao.stages.map((x) => (x * duration) / total);
      const k = kcOn(das, crop.stageDays, fao.kc);
      crop.stage = k ? k.stage : das < 0 ? 'not sown yet' : 'past the harvest window';
      crop.kcToday = k ? r2(k.kc) : null;
      crop.stageDays = crop.stageDays.map((x) => Math.round(x));
    } else {
      crop.stage = das < 0 ? 'not sown yet' : null;
      limitations.push(`FAO-56 has no crop coefficient for ${source.name}, so its water use can't be estimated — only the reference ET0 is shown.`);
    }
    if (source.from !== 'calendar') {
      missing.push({ field: 'calendar', label: 'Season calendar', fix: 'Generate the calendar for this crop to get its irrigation events' });
    }
  } else {
    missing.push({ field: 'crop', label: 'Crop and sowing date', fix: 'Select a crop on the Farms page and generate its calendar' });
  }

  // ---- Daily table (exact days the calendar would use) ----
  const exactStages = fao && crop?.durationDays
    ? fao.stages.map((x) => (x * crop.durationDays) / fao.stages.reduce((a, b) => a + b, 0))
    : null;
  const days = wb.days.map((d) => {
    const k = exactStages ? kcOn(daysBetween(crop.sowingDate, d.date), exactStages, fao.kc) : null;
    return {
      ...d,
      kc: k ? r2(k.kc) : null,
      etcMm: k && d.et0Mm !== null ? r1(k.kc * d.et0Mm) : null,
    };
  });

  // ---- 7-day outlook (forecast days only) ----
  const forecast = days.filter((d) => d.kind === 'forecast');
  const sum = (arr, key) => r1(arr.reduce((s, d) => s + (d[key] ?? 0), 0));
  const cropDays = forecast.filter((d) => d.etcMm !== null);
  const etcMm = cropDays.length ? sum(cropDays, 'etcMm') : null;
  const rainOnCropDays = cropDays.length ? sum(cropDays, 'rainMm') : null;
  const netMm = etcMm === null ? null : r1(Math.max(0, etcMm - rainOnCropDays));
  const outlook = {
    from: forecast[0]?.date, to: forecast[forecast.length - 1]?.date, days: forecast.length,
    rainMm: sum(forecast, 'rainMm'), et0Mm: sum(forecast, 'et0Mm'),
    cropDays: cropDays.length, etcMm, rainOnCropDaysMm: rainOnCropDays, netMm,
    netLitres: netMm !== null && acres !== null ? Math.round((netMm * acres * LITRES_PER_MM_PER_ACRE) / 100) * 100 : null,
    acres,
  };
  if (netMm !== null && acres === null) limitations.push(`Litres aren't shown because this farm's area unit (${farm.areaUnit}) can't be converted to acres.`);

  // ---- Upcoming irrigation events from the calendar, judged by the calendar's own rule ----
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const lastDay = days[days.length - 1].date;
  const events = (plan?.events || [])
    .filter((e) => e.type === 'irrigation' && e.date >= wb.today && e.date <= lastDay)
    .map((e) => {
      const base = { date: e.date, title: e.title, done: !!e.done };
      if (e.done) return { ...base, decision: 'done', reason: 'Already ticked as done in your calendar.' };
      const before = [byDate[addDays(e.date, -2)], byDate[addDays(e.date, -1)]];
      if (before.some((d) => !d || d.rainMm === null)) {
        return { ...base, decision: 'unknown', reason: 'Rain data for the 48 hours before this date is not available.' };
      }
      const rain48hMm = r1(before[0].rainMm + before[1].rainMm);
      const basis = before.some((d) => d.kind === 'forecast') ? 'forecast' : 'recent-model-estimate';
      const said = basis === 'forecast' ? 'is forecast' : 'fell (weather-model estimate)';
      const day = byDate[e.date];
      const skip = rain48hMm > RULE_MM;
      return {
        ...base, rain48hMm, basis,
        decision: skip ? 'skip' : 'irrigate',
        eventDay: day ? { rainMm: day.rainMm, rainProbability: day.rainProbability } : null,
        reason: skip
          ? `Skip: about ${rain48hMm} mm of rain ${said} in the 48 hours before — the calendar rule skips irrigation above ${RULE_MM} mm.`
          : `Go ahead: only about ${rain48hMm} mm of rain ${said} in the 48 hours before (the rule skips above ${RULE_MM} mm).`,
      };
    });
  const nextEvent = (plan?.events || []).find((e) => e.type === 'irrigation' && !e.done && e.date > lastDay);
  if (plan && !events.length) {
    limitations.push(nextEvent
      ? `No irrigation event in your calendar during the next 7 days (next one: ${nextEvent.date}).`
      : 'No upcoming irrigation events in your calendar.');
  }

  if (['rain-fed', 'rainfed'].includes(norm(farm.waterSource))) {
    limitations.push('This farm is recorded as rain-fed — the calendar irrigation events only apply if you have a water source for protective irrigation.');
  }
  limitations.push('Rain for past days is the weather model’s estimate for this point, not a rain-gauge reading, and forecasts can change.');
  limitations.push('Crop water use is FAO-56 Kc × reference ET0 for a healthy crop. It is not adjusted for local wind or humidity, assumes all rain is useful, and ignores water already stored in the soil (which KisanAI does not measure). Treat it as a guide, not an amount to apply.');

  const status = crop?.kcToday != null && plan ? 'ok' : 'partial';
  return {
    status,
    farm: { id: farm.id, name: farm.name, waterSource: farm.waterSource || null },
    location: { lat, lon },
    today: wb.today,
    timezone: wb.timezone,
    crop,
    days,
    outlook,
    events,
    nextEventAfterWindow: nextEvent ? { date: nextEvent.date, title: nextEvent.title } : null,
    rule: { text: `Skip irrigation if more than ${RULE_MM} mm of rain fell in the 48 hours before (KisanAI calendar rule)`, thresholdMm: RULE_MM },
    missing,
    limitations,
    sources: [
      { title: wb.source, url: 'https://open-meteo.com/en/docs' },
      { title: 'FAO Irrigation and Drainage Paper 56, Chapter 6 — Tables 11 (stage lengths) and 12 (crop coefficients)', url: FAO56_URL },
    ],
    fetchedAt: wb.fetchedAt,
  };
}
