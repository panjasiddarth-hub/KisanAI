// src/services/plotService.js — validation, views and rules for plots and crop cycles.
// Routes stay thin; everything here is deterministic and unit-testable.
import { newId } from '../database/repositories/store.js';
import { AREA_UNITS, toAcres, acresToHectares, AREA_TOLERANCE_ACRES, UNCONVERTIBLE_UNIT_NOTE } from './units.js';
import { isDate, todayStr, addDaysStr, sanitizeSoilTest, cleanString, SOIL_LIMITS } from './validation.js';
import { SOIL_MAP, seasonOf } from './farmRecommendation.js';
import { CROPS } from '../data/crops.js';
import { SEASONS, OBSERVATION_TYPES, HARVEST_UNITS } from '../database/models/CropCycle.js';

export const MAX_PLOTS_PER_FARM = 100;
export const MAX_PREVIOUS_CROPS = 20;
export const MAX_OBSERVATIONS = 500;
export const WATER_SOURCES = ['Borewell', 'Canal', 'River', 'Rain-fed', 'Drip Irrigation', 'Pond'];   // farm-form vocabulary
export const IRRIGATION_METHODS = ['Flood', 'Furrow', 'Drip', 'Sprinkler'];
export const SOIL_TYPE_LABELS = ['Black Cotton', 'Red Laterite', 'Alluvial', 'Sandy', 'Clay', 'Loamy'];
const INPUT_FIELDS = ['area', 'areaUnit', 'soilType', 'soilTest', 'waterAccess', 'previousCrops'];
// Names in any script (Telugu, Hindi, …), digits and a little punctuation.
const NAME_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} .,'()&/#_-]*$/u;
const round4 = (v) => Math.round(v * 1e4) / 1e4;
export const fmtAcres = (v) => (v == null ? '?' : String(Math.round(v * 100) / 100));

// ---- Crop names → knowledge-base name (same KB the recommendation and calendar agents use) ----
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
const CROP_INDEX = new Map();
for (const c of CROPS) {
  const [base, alias] = c.name.split(/\s*[()]\s*/).filter(Boolean);   // 'Paddy (Rice)' → Paddy, Rice
  for (const k of [c.name, base, alias]) if (k) CROP_INDEX.set(norm(k), c.name);
}
export const resolveCropKey = (name) => (name ? CROP_INDEX.get(norm(name)) || null : null);

function validName(raw, label, errors, max = 60) {
  const v = cleanString(raw, 500) ?? '';
  if (!v) { errors.push(`${label} is required`); return null; }
  if (v.length > max) { errors.push(`${label} must be at most ${max} characters`); return null; }
  if (!NAME_RE.test(v)) { errors.push(`${label} may contain letters, numbers, spaces and . , ' ( ) & / # _ -`); return null; }
  return v;
}

// ---------------------------------------------------------------------------------------------
// Plots
// ---------------------------------------------------------------------------------------------
// Request body → { data, errors }. Only whitelisted fields are read: owner, farm, ids, status and
// revision counters never come from the body. `current` (PATCH) supplies area/unit not sent.
export function sanitizePlotInput(body, { creating, current = null } = {}) {
  const data = {};
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { data, errors: ['Request body must be a JSON object'] };

  if (creating || body.name !== undefined) {
    const name = validName(body.name, 'name', errors);
    if (name) { data.name = name; data.nameKey = name.toLowerCase().replace(/\s+/g, ' '); }
  }

  if (creating || body.area !== undefined || body.areaUnit !== undefined) {
    const area = Number(body.area !== undefined ? body.area : current?.area);
    const unit = body.areaUnit !== undefined ? String(body.areaUnit) : current?.areaUnit || 'acres';
    let ok = true;
    if (!AREA_UNITS.includes(unit)) { errors.push(`areaUnit must be one of: ${AREA_UNITS.join(', ')}`); ok = false; }
    if (body.area === '' || body.area === null || !Number.isFinite(area) || area <= 0 || area > 100000) {
      errors.push('area must be a number greater than 0 (at most 100000)'); ok = false;
    }
    if (ok) { data.area = round4(area); data.areaUnit = unit; data.areaAcres = toAcres(area, unit); }
  }

  if (body.soilType !== undefined) {
    const s = cleanString(body.soilType, 60) || '';
    if (s && !SOIL_MAP[s.toLowerCase()]) errors.push(`soilType must be one of: ${SOIL_TYPE_LABELS.join(', ')}`);
    else data.soilType = s;
  }

  if (body.soilTest !== undefined) {
    const { value, errors: e } = sanitizeSoilTest(body.soilTest);
    errors.push(...e);
    if (!e.length) data.soilTest = value;
  }

  if (body.waterAccess !== undefined) {
    if (body.waterAccess === null) data.waterAccess = { source: '', method: '' };
    else if (typeof body.waterAccess !== 'object' || Array.isArray(body.waterAccess)) errors.push('waterAccess must be an object');
    else {
      const source = cleanString(body.waterAccess.source, 60) || '';
      const method = cleanString(body.waterAccess.method, 60) || '';
      const src = WATER_SOURCES.find((w) => w.toLowerCase() === source.toLowerCase());
      const met = IRRIGATION_METHODS.find((m) => m.toLowerCase() === method.toLowerCase());
      if (source && !src) errors.push(`waterAccess.source must be one of: ${WATER_SOURCES.join(', ')}`);
      if (method && !met) errors.push(`waterAccess.method must be one of: ${IRRIGATION_METHODS.join(', ')}`);
      if (src === 'Rain-fed' && met) errors.push('waterAccess.method must be empty for a rain-fed plot');
      if ((!source || src) && (!method || met)) data.waterAccess = { source: src || '', method: src === 'Rain-fed' ? '' : met || '' };
    }
  }

  if (body.previousCrops !== undefined) {
    if (!Array.isArray(body.previousCrops)) errors.push('previousCrops must be an array');
    else if (body.previousCrops.length > MAX_PREVIOUS_CROPS) errors.push(`previousCrops can hold at most ${MAX_PREVIOUS_CROPS} entries`);
    else {
      const thisYear = new Date().getUTCFullYear();
      const keepIds = new Set((current?.previousCrops || []).map((p) => p.id));
      const list = [];
      body.previousCrops.forEach((pc, i) => {
        const p = `previousCrops[${i}]`;
        if (!pc || typeof pc !== 'object') { errors.push(`${p} must be an object`); return; }
        const crop = validName(pc.crop, `${p}.crop`, errors);
        const season = (cleanString(pc.season, 20) || '').toLowerCase();
        if (season && !SEASONS.includes(season)) errors.push(`${p}.season must be one of: ${SEASONS.join(', ')}`);
        let year;
        if (pc.year !== undefined && pc.year !== null && pc.year !== '') {
          year = Number(pc.year);
          if (!Number.isInteger(year) || year < 1990 || year > thisYear) errors.push(`${p}.year must be a whole year between 1990 and ${thisYear}`);
        }
        list.push({
          id: keepIds.has(pc.id) ? pc.id : newId(),   // ids are server-issued; known ids are kept
          crop: crop || '', season, ...(year !== undefined && { year }), notes: cleanString(pc.notes, 200) || '',
        });
      });
      data.previousCrops = list;
    }
  }
  return { data, errors };
}

// Opt-in copy of the farm's whole-farm details into a new plot (fields the body didn't set).
// The farm record itself is never modified.
export function copyFromFarm(farm, body) {
  const data = {};
  const fields = [];
  const skipped = [];
  if (body.soilType === undefined && farm.soilType) {
    if (SOIL_MAP[String(farm.soilType).toLowerCase()]) { data.soilType = farm.soilType; fields.push('soilType'); }
    else skipped.push(`soil type "${farm.soilType}" is not a recognised soil type`);
  }
  if (body.soilTest === undefined && farm.soilTest) {
    const { value } = sanitizeSoilTest(farm.soilTest);
    if (value) { data.soilTest = value; fields.push('soilTest'); }
  }
  if (body.waterAccess === undefined && farm.waterSource) {
    const src = WATER_SOURCES.find((w) => w.toLowerCase() === String(farm.waterSource).toLowerCase());
    if (src) { data.waterAccess = { source: src, method: src === 'Drip Irrigation' ? 'Drip' : '' }; fields.push('waterAccess'); }
    else skipped.push(`water source "${farm.waterSource}" is not a recognised source`);
  }
  if (body.previousCrops === undefined && Array.isArray(farm.crops) && farm.crops.length) {
    data.previousCrops = farm.crops.filter((c) => typeof c === 'string' && c.trim()).slice(0, MAX_PREVIOUS_CROPS)
      .map((c) => ({ id: newId(), crop: c.trim().slice(0, 60), season: '', notes: "From the farm's crop list (season and year unknown)" }));
    if (data.previousCrops.length) fields.push('previousCrops');
  }
  return { data, fields, skipped };
}

const stable = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const normPrev = (list) => (list || []).map(({ crop, season, year, notes }) => ({ crop, season: season || '', year: year ?? null, notes: notes || '' }));
// Agronomic inputs that actually change (so the revision only moves on real changes).
export function changedInputs(data, plot) {
  return INPUT_FIELDS.filter((k) => {
    if (data[k] === undefined) return false;
    if (k === 'previousCrops') return stable(normPrev(data[k])) !== stable(normPrev(plot[k]));
    if (k === 'waterAccess') return stable({ source: data[k].source, method: data[k].method }) !== stable({ source: plot[k]?.source || '', method: plot[k]?.method || '' });
    return stable(data[k] ?? null) !== stable(plot[k] ?? null);
  });
}

// Area allocation of a farm's active plots (optionally replacing one plot / adding a new area).
export function allocation(farm, activePlots, { excludeId = null, add } = {}) {
  const farmAcres = toAcres(farm.area, farm.areaUnit || 'acres');
  const considered = activePlots.filter((p) => p.id !== excludeId);
  const unconvertible = considered.filter((p) => p.areaAcres == null).length + (add === null ? 1 : 0);
  const allocatedAcres = round4(considered.reduce((s, p) => s + (p.areaAcres || 0), 0) + (add || 0));
  const warnings = [];
  if (farmAcres == null) warnings.push(`The farm area (${farm.area} ${farm.areaUnit || ''}) can't be converted, so plot areas aren't checked against it. ${UNCONVERTIBLE_UNIT_NOTE}`);
  if (unconvertible) warnings.push(`${unconvertible} plot area(s) can't be converted, so the farm's area allocation can't be checked. ${UNCONVERTIBLE_UNIT_NOTE}`);
  return {
    farmAcres,
    allocatedAcres,
    unallocatedAcres: farmAcres == null ? null : round4(Math.max(0, farmAcres - allocatedAcres)),
    checkable: farmAcres != null && unconvertible === 0,
    warnings,
  };
}
export const exceedsFarm = (alloc) => alloc.checkable && alloc.allocatedAcres > alloc.farmAcres + AREA_TOLERANCE_ACRES;
export const areaExceededMessage = (alloc) =>
  `Plots would cover ${fmtAcres(alloc.allocatedAcres)} acres but the farm is ${fmtAcres(alloc.farmAcres)} acres. Reduce the plot area or increase the farm area.`;

export function plotView(p, extra = {}) {
  const soilTest = p.soilTest && Object.keys(p.soilTest).length ? p.soilTest : null;
  const source = p.waterAccess?.source || '';
  return {
    id: p.id, farmId: p.farmId, name: p.name, status: p.status, archivedAt: p.archivedAt || null,
    area: p.area, areaUnit: p.areaUnit, areaAcres: p.areaAcres ?? null, areaHectares: acresToHectares(p.areaAcres ?? null),
    soilType: p.soilType || '',
    soilTest,
    soilCardValues: soilTest ? Object.keys(SOIL_LIMITS).filter((k) => soilTest[k] != null).length : 0,
    waterAccess: { source, method: p.waterAccess?.method || '', irrigated: source ? source !== 'Rain-fed' : null },
    previousCrops: p.previousCrops || [],
    inputsRevision: p.inputsRevision, inputsUpdatedAt: p.inputsUpdatedAt,
    copiedFromFarm: p.copiedFromFarm?.at ? { at: p.copiedFromFarm.at, fields: p.copiedFromFarm.fields || [] } : null,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
    ...extra,
  };
}

export const farmBrief = (farm) => ({ id: farm.id, name: farm.name, area: farm.area, areaUnit: farm.areaUnit || 'acres', areaAcres: toAcres(farm.area, farm.areaUnit || 'acres') });

// The farm-level ("whole farm") details that Milestone 1–2 features keep using for farms without plots.
export function wholeFarmSummary(farm) {
  const st = farm.soilTest || null;
  return {
    hasFarmLevelData: !!(farm.soilType || (st && Object.keys(st).length) || farm.waterSource || farm.crops?.length || farm.selectedCrop?.crop),
    soilType: farm.soilType || '',
    soilCardValues: st ? Object.keys(SOIL_LIMITS).filter((k) => st[k] != null).length : 0,
    waterSource: farm.waterSource || '',
    crops: farm.crops || [],
    selectedCrop: farm.selectedCrop?.crop ? { crop: farm.selectedCrop.displayName || farm.selectedCrop.crop, sowingDate: farm.selectedCrop.sowingDate || null } : null,
  };
}

// Per-farm plot counts for farm lists: one query for plots, one for open cycles.
export function plotSummaries(activePlots, openCycles) {
  const out = new Map();
  for (const p of activePlots) {
    const s = out.get(p.farmId) || { count: 0, allocatedAcres: 0, unconvertible: 0, openCycles: 0 };
    s.count += 1;
    if (p.areaAcres == null) s.unconvertible += 1; else s.allocatedAcres = round4(s.allocatedAcres + p.areaAcres);
    out.set(p.farmId, s);
  }
  for (const c of openCycles) { const s = out.get(c.farmId); if (s) s.openCycles += 1; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Crop cycles
// ---------------------------------------------------------------------------------------------
const TRANSITIONS = { planned: ['active', 'abandoned'], active: ['harvested', 'abandoned'], harvested: [], abandoned: [] };

function checkSowing(v, label, errors) {
  if (!isDate(v)) { errors.push(`${label} must be a real date (YYYY-MM-DD)`); return false; }
  if (v > todayStr()) { errors.push(`${label} cannot be in the future — use plannedSowingDate for a planned crop`); return false; }
  if (v < addDaysStr(todayStr(), -730)) { errors.push(`${label} must be within the last 2 years`); return false; }
  return true;
}
function checkPlanned(v, label, errors) {
  if (!isDate(v)) { errors.push(`${label} must be a real date (YYYY-MM-DD)`); return false; }
  if (v < addDaysStr(todayStr(), -60) || v > addDaysStr(todayStr(), 365)) { errors.push(`${label} must be between 60 days ago and one year ahead`); return false; }
  return true;
}
function checkSeason(v, errors) {
  const s = String(v).toLowerCase();
  if (!SEASONS.includes(s)) { errors.push(`season must be one of: ${SEASONS.join(', ')}`); return null; }
  return s;
}

export function sanitizeCycleCreate(body, plot) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { data: null, errors: ['Request body must be a JSON object'] };
  const crop = validName(body.crop, 'crop', errors);
  const status = body.status === undefined ? (body.sowingDate ? 'active' : 'planned') : String(body.status);
  if (!['planned', 'active'].includes(status)) errors.push('status must be planned or active when a crop cycle is created');
  const data = {
    crop: crop || '', cropKey: resolveCropKey(crop), status, isOpen: true, source: 'manual', recommendationId: null,
    variety: cleanString(body.variety, 60) || '', notes: cleanString(body.notes, 1000) || '',
    plannedSowingDate: null, sowingDate: null, plotRevisionAtStart: plot.inputsRevision ?? null, revision: 1,
  };
  if (body.plannedSowingDate) { if (checkPlanned(body.plannedSowingDate, 'plannedSowingDate', errors)) data.plannedSowingDate = body.plannedSowingDate; }
  else if (status === 'planned') errors.push('plannedSowingDate is required for a planned crop cycle');
  if (body.sowingDate) { if (checkSowing(body.sowingDate, 'sowingDate', errors)) data.sowingDate = body.sowingDate; }
  else if (status === 'active') errors.push('sowingDate is required for an active crop cycle');
  if (body.sowingDate && status === 'planned') errors.push('A planned crop cycle has no sowing date yet — set status to active');
  if (body.season !== undefined && body.season !== '') { const s = checkSeason(body.season, errors); if (s) data.season = s; }
  else if (data.sowingDate || data.plannedSowingDate) data.season = seasonOf(data.sowingDate || data.plannedSowingDate);
  return { data, errors };
}

// PATCH → { set, errors, conflict }. Closed cycles (harvested/abandoned) are history: only notes
// (and harvest details of a harvested cycle) can still change.
export function planCycleUpdate(cycle, body) {
  const errors = [];
  const set = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { set, errors: ['Request body must be a JSON object'] };
  const keys = ['status', 'crop', 'variety', 'season', 'plannedSowingDate', 'sowingDate', 'notes', 'harvest'].filter((k) => body[k] !== undefined);
  if (!cycle.isOpen) {
    const allowed = ['notes', ...(cycle.status === 'harvested' ? ['harvest'] : [])];
    const blocked = keys.filter((k) => !allowed.includes(k) && !(k === 'status' && body.status === cycle.status));
    if (blocked.length) return { set, errors, conflict: `This crop cycle is ${cycle.status} and closed; only ${allowed.join(' and ')} can be changed (not ${blocked.join(', ')}).` };
  }
  const target = body.status !== undefined ? String(body.status) : cycle.status;
  if (target !== cycle.status && !(TRANSITIONS[cycle.status] || []).includes(target)) {
    return { set, errors, conflict: `A ${cycle.status} crop cycle can't become ${target}. Allowed: ${(TRANSITIONS[cycle.status] || []).join(', ') || 'none'}.` };
  }
  if (body.crop !== undefined) {
    if (cycle.status !== 'planned') return { set, errors, conflict: 'The crop can only be changed while the cycle is planned. Abandon it and start a new cycle instead.' };
    const crop = validName(body.crop, 'crop', errors);
    if (crop) { set.crop = crop; set.cropKey = resolveCropKey(crop); }
  }
  if (body.variety !== undefined) set.variety = cleanString(body.variety, 60) || '';
  if (body.notes !== undefined) set.notes = cleanString(body.notes, 1000) || '';
  if (body.season !== undefined) { const s = checkSeason(body.season, errors); if (s) set.season = s; }
  if (body.plannedSowingDate !== undefined) {
    if (cycle.status !== 'planned') errors.push('plannedSowingDate can only be changed while the cycle is planned');
    else if (checkPlanned(body.plannedSowingDate, 'plannedSowingDate', errors)) set.plannedSowingDate = body.plannedSowingDate;
  }
  if (body.sowingDate !== undefined) {
    if (target === 'planned') errors.push('A planned crop cycle has no sowing date yet — set status to active');
    else if (checkSowing(body.sowingDate, 'sowingDate', errors)) set.sowingDate = body.sowingDate;
  }
  const sowing = set.sowingDate || cycle.sowingDate;
  if (target === 'active' && cycle.status === 'planned' && !sowing) errors.push('sowingDate is required to mark the crop as sown (active)');

  const becomingHarvested = target === 'harvested' && cycle.status !== 'harvested';
  if (becomingHarvested || (body.harvest !== undefined && cycle.status === 'harvested')) {
    const h = body.harvest;
    if (!h || typeof h !== 'object') errors.push('harvest.date is required to mark the crop as harvested');
    else {
      const hv = { ...(cycle.harvest || {}) };
      if (h.date !== undefined || !hv.date) {
        if (!isDate(h.date)) errors.push('harvest.date must be a real date (YYYY-MM-DD)');
        else if (h.date > todayStr()) errors.push('harvest.date cannot be in the future');
        else if (sowing && h.date < sowing) errors.push(`harvest.date cannot be before the sowing date (${sowing})`);
        else hv.date = h.date;
      }
      if (h.quantity !== undefined && h.quantity !== null && h.quantity !== '') {
        const q = Number(h.quantity);
        if (!Number.isFinite(q) || q <= 0 || q > 1e7) errors.push('harvest.quantity must be a number greater than 0');
        else if (!HARVEST_UNITS.includes(h.unit)) errors.push(`harvest.unit must be one of: ${HARVEST_UNITS.join(', ')}`);
        else { hv.quantity = q; hv.unit = h.unit; }
      }
      set.harvest = hv;
    }
  } else if (body.harvest !== undefined) errors.push('harvest can only be recorded when the status becomes harvested');

  if (target !== cycle.status) {
    set.status = target;
    if (!(TRANSITIONS[target] || []).length) { set.isOpen = false; set.closedAt = new Date(); }
  }
  return { set, errors };
}

export function sanitizeObservation(body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { obs: null, errors: ['Request body must be a JSON object'] };
  const date = body.date || todayStr();
  if (!isDate(date)) errors.push('date must be a real date (YYYY-MM-DD)');
  else if (date > todayStr()) errors.push('date cannot be in the future');
  else if (date < addDaysStr(todayStr(), -730)) errors.push('date must be within the last 2 years');
  const type = String(body.type || 'note');
  if (!OBSERVATION_TYPES.includes(type)) errors.push(`type must be one of: ${OBSERVATION_TYPES.join(', ')}`);
  const text = cleanString(body.text, 5000) || '';
  if (!text) errors.push('text is required');
  else if (text.length > 1000) errors.push('text must be at most 1000 characters');
  const obs = { id: newId(), date, type, text, createdAt: new Date() };
  if (body.value !== undefined && body.value !== null && body.value !== '') {
    const v = Number(body.value);
    if (!Number.isFinite(v) || Math.abs(v) > 1e9) errors.push('value must be a finite number');
    else obs.value = v;
  }
  if (body.unit) obs.unit = cleanString(body.unit, 20);
  return { obs, errors };
}

const byNewest = (a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.id < b.id ? 1 : -1);
// Cursor pagination over a cycle's observations (newest first). Unknown cursor → null page.
export function pageObservations(list, { limit, cursor }) {
  const sorted = [...(list || [])].sort(byNewest);
  let start = 0;
  if (cursor) {
    const i = sorted.findIndex((o) => o.id === cursor);
    if (i < 0) return null;
    start = i + 1;
  }
  const items = sorted.slice(start, start + limit);
  return { items, nextCursor: start + limit < sorted.length ? items[items.length - 1].id : null, total: sorted.length };
}

export function cycleView(c, { observations = 'latest' } = {}) {
  const { userId, _id, __v, observations: obs = [], ...rest } = c;
  const view = { ...rest, id: c.id, harvest: c.harvest?.date ? c.harvest : null, observationCount: obs.length };
  if (observations === 'latest') view.latestObservations = [...obs].sort(byNewest).slice(0, 20);
  return view;
}
export const cycleBrief = (c) => c && { id: c.id, crop: c.crop, status: c.status };
