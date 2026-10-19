// src/services/plotAdvice.js — plot-level advice (Milestone 4).
//
// The plot's own soil, area, water access and crop history plus its crop cycle are fed to the
// existing agents with explicit overrides, so nothing silently falls back to the farm's soil, crop,
// calendar or recommendations. The farm supplies only property context: name, location, coordinates.
import { recommendCropsForFarm } from './farmRecommendation.js';
import { fertilizerPlanForFarm } from './farmFertilizer.js';
import { irrigationForFarm } from './farmIrrigation.js';
import { marketForFarm } from './farmMarket.js';
import { hasConfirmedLocation } from './farmContext.js';
import { WeatherUnavailableError } from './openMeteo.js';
import { generateTimeline } from '../routes/calendar.routes.js';
import { newId } from '../database/repositories/store.js';

const HOUR = 3600 * 1000;
export const STALE_AFTER = { irrigationWeatherHours: 6, marketHours: 24 };

// Farm-shaped view of one plot for the existing agents. id never matches a farm-level record.
export function plotFarmView(farm, plot, cycle) {
  return {
    id: `plot:${plot.id}`,
    name: `${farm.name} · ${plot.name}`,
    location: farm.location,
    coordinates: farm.coordinates,
    area: plot.area,
    areaUnit: plot.areaUnit,
    soilType: plot.soilType || '',
    soilTest: plot.soilTest || null,
    waterSource: plot.waterAccess?.source || '',
    crops: (plot.previousCrops || []).map((c) => c.crop),
    selectedCrop: cycle ? {
      crop: cycle.cropKey || cycle.crop,
      displayName: cycle.crop,
      calendarCrop: cycle.cropKey || cycle.crop,
      sowingDate: cycle.sowingDate || cycle.plannedSowingDate,
      recommendationId: cycle.recommendationId || null,
    } : null,
  };
}

export const cycleDate = (cycle) => cycle.sowingDate || cycle.plannedSowingDate;
export const cycleCrop = (cycle) => cycle.cropKey || cycle.crop;

export async function recommendForPlot({ farm, plot, plannedSowingDate }) {
  const view = plotFarmView(farm, plot, null);
  return recommendCropsForFarm({ farm: view, cropHistory: view.crops, plannedSowingDate });
}

function inputSnapshot(farm, plot, cycle, plan) {
  return {
    plot: { name: plot.name, area: plot.area, areaUnit: plot.areaUnit, areaAcres: plot.areaAcres, soilType: plot.soilType || '', soilTest: plot.soilTest || null, waterAccess: plot.waterAccess || null },
    cycle: { crop: cycle.crop, cropKey: cycle.cropKey, status: cycle.status, season: cycle.season, sowingDate: cycle.sowingDate, plannedSowingDate: cycle.plannedSowingDate },
    farm: { location: farm.location, locationConfirmed: hasConfirmedLocation(farm) },
    calendarId: plan?.id || null,
  };
}
const mapStatus = (s) => (s === 'ok' ? 'ok' : s === 'insufficient_data' ? 'insufficient_data' : 'partial');

// Runs one advisory agent for the plot's crop cycle and returns an assessment record (not saved).
export async function runAssessment({ userId, farm, plot, cycle, plan, latestRecommendation, agent }) {
  const view = plotFarmView(farm, plot, cycle);
  const base = {
    userId, farmId: farm.id, plotId: plot.id, cropCycleId: cycle.id, agent,
    plotRevision: plot.inputsRevision || 1, cycleRevision: cycle.revision || 1,
    inputs: inputSnapshot(farm, plot, cycle, plan), dataTimestamps: {}, sources: [], result: null, error: null,
  };
  try {
    if (agent === 'fertilizer') {
      const r = await fertilizerPlanForFarm({ userId, farm: view, crop: view.selectedCrop.calendarCrop, plan: plan || null });
      if (r.error) return { ...base, status: 'insufficient_data', error: r.error };
      return {
        ...base, status: mapStatus(r.status), result: r,
        sources: [
          { kind: 'calculation', name: 'Crop dose × ICAR-IISS soil-test rating; DAP / urea / MOP with stage-wise N split' },
          ...(r.model?.used ? [{ kind: 'trained_model', name: 'Soil-fertility rating model (random forest)', detail: 'second opinion only — does not change the dose' }] : []),
        ],
      };
    }
    if (agent === 'irrigation') {
      if (!hasConfirmedLocation(farm)) {
        return { ...base, status: 'insufficient_data', error: 'The farm has no confirmed location, so no weather data can be used.', result: { missing: [{ field: 'coordinates', label: 'Confirmed farm location', fix: 'Edit the farm → Farm location, then confirm it' }] } };
      }
      const r = await irrigationForFarm({ userId, farm: view, plan: plan || null });
      return {
        ...base, status: mapStatus(r.status), result: r, dataTimestamps: { weatherFetchedAt: r.fetchedAt || null },
        sources: [
          { kind: 'external_api', name: 'Open-Meteo forecast and ET₀', detail: r.fetchedAt ? `fetched ${r.fetchedAt}` : 'live' },
          { kind: 'calculation', name: 'FAO-56 crop water use (Kc × ET₀ − effective rain)' },
        ],
      };
    }
    if (agent === 'market') {
      const r = await marketForFarm({ userId, farm: view, latestRecommendation: latestRecommendation || null });
      const live = r.live || r.crops?.find((c) => c.live)?.live || null;
      return {
        ...base, status: mapStatus(r.status), result: r, dataTimestamps: { checkedAt: new Date().toISOString() },
        // Only sources that actually contributed are listed: live mandi prices appear only when the
        // data.gov.in call succeeded (otherwise the result says why they are missing).
        sources: [
          { kind: 'trained_model', name: 'Market price model (XGBoost)', detail: 'coverage check — which crops, mandis and states the model knows' },
          ...(live?.status === 'ok' ? [{ kind: 'external_api', name: 'data.gov.in Agmarknet mandi prices', detail: 'live' }] : []),
        ],
      };
    }
    return { ...base, status: 'error', error: `Unknown agent ${agent}` };
  } catch (err) {
    return { ...base, status: 'error', error: err instanceof WeatherUnavailableError ? err.message : 'The agent failed to run.' };
  }
}

// Why stored advice no longer matches the plot / cycle (empty → current).
export function assessmentState(a, plot, cycle, now = Date.now()) {
  if (!a) return { assessed: false, stale: false, reasons: [] };
  const reasons = [];
  if (!cycle || a.cropCycleId !== cycle.id) reasons.push('it was made for a different crop cycle');
  if ((a.plotRevision || 1) < (plot.inputsRevision || 1)) reasons.push('the plot details (area, soil, water or crop history) changed');
  if (cycle && a.cropCycleId === cycle.id && (a.cycleRevision || 1) < (cycle.revision || 1)) reasons.push('the crop, season or dates changed');
  if (a.agent === 'irrigation' && a.dataTimestamps?.weatherFetchedAt && now - new Date(a.dataTimestamps.weatherFetchedAt) > STALE_AFTER.irrigationWeatherHours * HOUR) {
    reasons.push(`the weather data is more than ${STALE_AFTER.irrigationWeatherHours} hours old`);
  }
  if (a.agent === 'market' && now - new Date(a.createdAt) > STALE_AFTER.marketHours * HOUR) reasons.push(`the market check is more than ${STALE_AFTER.marketHours} hours old`);
  return { assessed: true, stale: reasons.length > 0, reasons };
}

export function recommendationState(rec, plot) {
  if (!rec) return { stale: false, reasons: [] };
  const reasons = (rec.plotRevision || 1) < (plot.inputsRevision || 1) ? ['the plot details changed after this recommendation was made'] : [];
  return { stale: reasons.length > 0, reasons };
}

export function calendarState(plan, cycle) {
  if (!plan) return { stale: false, reasons: [] };
  const reasons = [];
  if (plan.basis?.sowingDate !== cycleDate(cycle)) reasons.push(`the sowing date is now ${cycleDate(cycle)} (calendar built for ${plan.basis?.sowingDate})`);
  if (plan.basis?.crop !== cycleCrop(cycle)) reasons.push(`the crop is now ${cycleCrop(cycle)}`);
  return { stale: reasons.length > 0, reasons };
}

// Calendar events for a crop cycle with stable ids. Each event gets a template key
// (type|title|occurrence); on regeneration an event with the same key keeps its id and done flag.
export function buildCycleTimeline(cycle, plot, previousEvents = []) {
  const crop = cycleCrop(cycle);
  const sowingDate = cycleDate(cycle);
  const { events, harvestWindow, warnings } = generateTimeline({ crop, sowingDate, areaAcres: plot.areaAcres || 1 });
  const prior = new Map(previousEvents.filter((e) => e.key).map((e) => [e.key, e]));
  const seen = new Map();
  const keyed = events.map((e) => {
    const base = `${e.type}|${e.title}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    const key = `${base}|${n}`;
    const old = prior.get(key);
    return { ...e, key, id: old?.id || newId(), done: old ? !!old.done : false };
  });
  return { crop, sowingDate, events: keyed, harvestWindow, warnings, preserved: keyed.filter((e) => prior.has(e.key)).length };
}
