// src/services/farmContext.js — small helpers shared by the farm-linked agents
// (calendar, fertilizer, irrigation, market).

import { plans } from '../database/repositories/store.js';
import { isValidCoord } from './openMeteo.js';
import { ACRES_PER_UNIT } from './units.js';

// Farm area → acres, using the shared unit table (services/units.js). Bigha differs by state,
// so it is never converted automatically. Re-exported for existing importers.
export { ACRES_PER_UNIT };

// Returns null when the farm's area unit can't be converted reliably.
export function farmAreaAcres(farm) {
  const factor = ACRES_PER_UNIT[farm?.areaUnit || 'acres'];
  if (!factor || !(Number(farm?.area) > 0)) return null;
  return Math.round(Number(farm.area) * factor * 100) / 100;
}

// Farm features only use a location the farmer has explicitly confirmed (no defaults).
export function hasConfirmedLocation(farm) {
  const c = farm?.coordinates;
  return !!(c && isValidCoord(c.lat, c.lon) && c.confirmedAt);
}

// The farm's current season plan: the calendar generated for the crop the farmer selected
// (same crop + sowing date); otherwise the farm's most recently created plan; otherwise null.
export async function activePlanForFarm(userId, farm) {
  const sel = farm?.selectedCrop;
  if (sel?.calendarCrop && sel?.sowingDate) {
    const plan = await plans.findForFarm(userId, farm.id, sel.calendarCrop, sel.sowingDate);
    if (plan) return plan;
  }
  const all = await plans.list(userId); // newest first
  // Farm-level calendars only — a plot's calendar (Milestone 4) belongs to that plot, not the farm.
  return all.find((p) => p.farmId === farm.id && !p.plotId) || null;
}

export const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysBetween = (fromStr, toStr) =>
  Math.round((new Date(`${toStr}T00:00:00Z`) - new Date(`${fromStr}T00:00:00Z`)) / 86400000);
