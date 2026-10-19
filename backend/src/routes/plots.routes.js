// src/routes/plots.routes.js — /api/farms/:farmId/plots/* (auth is applied by the farms router).
//
// Ownership: every handler loads the farm by (owner, farmId), the plot by (owner, farmId, plotId)
// and the cycle by (owner, plotId, cycleId). A mismatch at any level is a 404, so records can't be
// read or written through another farmer's — or another plot's — URL. Owner and parent ids are
// never read from the request body.
import { Router } from 'express';
import plotPlanRouter from './plotPlan.routes.js';
import { farms, plots, cropCycles, StoreConflict, withFarmLock } from '../database/repositories/store.js';
import {
  MAX_PLOTS_PER_FARM, MAX_OBSERVATIONS, sanitizePlotInput, copyFromFarm, changedInputs, allocation, exceedsFarm,
  areaExceededMessage, plotView, farmBrief, wholeFarmSummary, sanitizeCycleCreate, planCycleUpdate,
  sanitizeObservation, pageObservations, cycleView, cycleBrief,
} from '../services/plotService.js';

const router = Router({ mergeParams: true });

const isObjectId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);
const badRequest = (res, errors) => res.status(400).json({ error: errors.join('; '), details: errors });
const conflict = (res, error, extra = {}) => res.status(409).json({ error, ...extra });
const notFound = (res, what) => res.status(404).json({ error: `${what} not found` });

// Async handler: expected store conflicts → 409, anything else → the app's error handler.
const handle = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) {
    if (err instanceof StoreConflict) return conflict(res, err.message, { code: err.code });
    next(err);
  }
};

function pageParams(query) {
  const errors = [];
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push('limit must be a whole number from 1 to 100');
  const cursor = query.cursor || null;
  if (cursor && !isObjectId(cursor)) errors.push('cursor is not valid');
  return { limit, cursor, errors };
}

async function loadFarm(req, res) {
  const farm = await farms.get(req.user.id, String(req.params.farmId));
  if (!farm) notFound(res, 'Farm');
  return farm;
}
async function loadPlot(req, res) {
  const farm = await loadFarm(req, res);
  if (!farm) return {};
  const plot = await plots.get(req.user.id, farm.id, String(req.params.plotId));
  if (!plot) notFound(res, 'Plot');
  return { farm, plot };
}
async function loadCycle(req, res) {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return {};
  const cycle = await cropCycles.get(req.user.id, plot.id, String(req.params.cycleId));
  if (!cycle) notFound(res, 'Crop cycle');
  return { farm, plot, cycle };
}

// ---------------------------------------------------------------------------------------------
// Plots
// ---------------------------------------------------------------------------------------------
router.get('/', handle(async (req, res) => {
  const farm = await loadFarm(req, res);
  if (!farm) return;
  const status = ['active', 'archived', 'all'].includes(req.query.status) ? req.query.status : 'active';
  const [all, open] = await Promise.all([plots.listForFarm(req.user.id, farm.id, { status: 'all' }), cropCycles.listOpenForUser(req.user.id)]);
  const active = all.filter((p) => p.status === 'active');
  const openByPlot = new Map(open.filter((c) => c.farmId === farm.id).map((c) => [c.plotId, c]));
  res.json({
    farm: farmBrief(farm),
    allocation: allocation(farm, active),
    counts: { active: active.length, archived: all.length - active.length },
    plots: all.filter((p) => status === 'all' || p.status === status).map((p) => plotView(p, { openCycle: cycleBrief(openByPlot.get(p.id)) || null })),
    wholeFarm: wholeFarmSummary(farm),
  });
}));

router.post('/', handle(async (req, res) => {
  const farm = await loadFarm(req, res);
  if (!farm) return;
  const body = req.body || {};
  const { data, errors } = sanitizePlotInput(body, { creating: true });
  if (errors.length) return badRequest(res, errors);
  let copied = null;
  const warnings = [];
  if (body.copyFromFarm === true) {
    const c = copyFromFarm(farm, body);
    Object.assign(data, c.data);
    copied = { at: new Date(), fields: c.fields };
    warnings.push(...c.skipped.map((s) => `Not copied: ${s}.`));
  }
  // Limit, allocation and insert run under the farm lock (one transaction in MongoDB): concurrent
  // requests can't together exceed the farm area. The farm is re-read inside the lock.
  const outcome = await withFarmLock(req.user.id, farm.id, async (session) => {
    if ((await plots.countForFarm(req.user.id, farm.id, { session })) >= MAX_PLOTS_PER_FARM) {
      return { status: 409, body: { error: `A farm can have at most ${MAX_PLOTS_PER_FARM} plots (including archived ones).`, code: 'PLOT_LIMIT' } };
    }
    const current = (await farms.get(req.user.id, farm.id, { session })) || farm;
    const active = await plots.listForFarm(req.user.id, farm.id, { status: 'active', session });
    const alloc = allocation(current, active, { add: data.areaAcres });
    if (exceedsFarm(alloc)) return { status: 409, body: { error: areaExceededMessage(alloc), code: 'AREA_EXCEEDS_FARM', allocation: alloc } };
    const plot = await plots.create({
      userId: req.user.id, farmId: farm.id, status: 'active', soilType: '', soilTest: null,
      waterAccess: { source: '', method: '' }, previousCrops: [],
      ...data, inputsRevision: 1, inputsUpdatedAt: new Date(), ...(copied && { copiedFromFarm: copied }),
    }, { session });
    return { plot, alloc };
  });
  if (outcome.body) return res.status(outcome.status).json(outcome.body);
  warnings.push(...outcome.alloc.warnings);
  res.status(201).json({ ...plotView(outcome.plot, { openCycle: null }), allocation: outcome.alloc, warnings });
}));

router.get('/:plotId', handle(async (req, res) => {
  const { plot } = await loadPlot(req, res);
  if (!plot) return;
  const [open, cycleCount] = await Promise.all([cropCycles.findOpen(req.user.id, plot.id), cropCycles.countForPlot(req.user.id, plot.id)]);
  res.json(plotView(plot, { openCycle: open ? cycleView(open, { observations: 'none' }) : null, cycleCount }));
}));

router.patch('/:plotId', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  const body = req.body || {};
  if (body.status !== undefined && !['active', 'archived'].includes(body.status)) return badRequest(res, ['status must be active or archived']);
  const archiving = body.status === 'archived' && plot.status === 'active';
  const restoring = body.status === 'active' && plot.status === 'archived';
  if (plot.status === 'archived' && !restoring) {
    return conflict(res, 'This plot is archived. Restore it (status: active) before editing it.', { code: 'PLOT_ARCHIVED' });
  }
  const { data, errors } = sanitizePlotInput(body, { creating: false, current: plot });
  if (errors.length) return badRequest(res, errors);

  if (archiving) {
    const open = await cropCycles.findOpen(req.user.id, plot.id);
    if (open) return conflict(res, `This plot has an open crop cycle (${open.crop}, ${open.status}). Harvest or abandon it before archiving the plot.`, { code: 'OPEN_CYCLE' });
  }
  const changed = changedInputs(data, plot);
  const set = { ...data };
  if (archiving) Object.assign(set, { status: 'archived', archivedAt: new Date() });
  if (restoring) Object.assign(set, { status: 'active', archivedAt: null });
  if (changed.length) set.inputsUpdatedAt = new Date();
  if (!Object.keys(set).length) return res.json({ ...plotView(plot), changedInputs: [] });
  const ops = { set, inc: changed.length ? { inputsRevision: 1 } : {} };
  // Enlarging or restoring a plot can increase the allocation: check and write under the farm lock.
  const needsAreaCheck = !archiving && (data.areaAcres !== undefined || restoring);
  const write = async (session) => {
    let alloc = null;
    if (needsAreaCheck) {
      const current = (await farms.get(req.user.id, farm.id, { session })) || farm;
      const active = await plots.listForFarm(req.user.id, farm.id, { status: 'active', session });
      alloc = allocation(current, active, { excludeId: plot.id, add: data.areaAcres !== undefined ? data.areaAcres : plot.areaAcres });
      if (exceedsFarm(alloc)) return { status: 409, body: { error: areaExceededMessage(alloc), code: 'AREA_EXCEEDS_FARM', allocation: alloc } };
    }
    return { updated: await plots.update(req.user.id, farm.id, plot.id, ops, { session }), alloc };
  };
  const outcome = needsAreaCheck ? await withFarmLock(req.user.id, farm.id, write) : await write(null);
  if (outcome.body) return res.status(outcome.status).json(outcome.body);
  if (!outcome.updated) return notFound(res, 'Plot');
  res.json({ ...plotView(outcome.updated), changedInputs: changed, ...(outcome.alloc && { allocation: outcome.alloc, warnings: outcome.alloc.warnings }) });
}));

router.delete('/:plotId', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  const n = await cropCycles.countForPlot(req.user.id, plot.id);
  if (n > 0) {
    return conflict(res, `This plot has ${n} crop cycle(s) on record. Archive it instead (status: archived) to keep its crop history.`, { code: 'PLOT_HAS_HISTORY' });
  }
  const r = await plots.remove(req.user.id, farm.id, plot.id);
  if (!r.deletedCount) return notFound(res, 'Plot');
  res.json({ success: true, deleted: plot.id });
}));

// ---------------------------------------------------------------------------------------------
// Crop cycles
// ---------------------------------------------------------------------------------------------
router.get('/:plotId/cycles', handle(async (req, res) => {
  const { limit, cursor, errors } = pageParams(req.query);
  if (errors.length) return badRequest(res, errors);
  const { plot } = await loadPlot(req, res);
  if (!plot) return;
  const page = await cropCycles.listForPlot(req.user.id, plot.id, { limit, cursor });
  res.json({ items: page.items.map((c) => cycleView(c, { observations: 'none' })), nextCursor: page.nextCursor });
}));

router.post('/:plotId/cycles', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  if (plot.status !== 'active') return conflict(res, 'This plot is archived. Restore it before starting a crop cycle.', { code: 'PLOT_ARCHIVED' });
  const { data, errors } = sanitizeCycleCreate(req.body, plot);
  if (errors.length) return badRequest(res, errors);
  const cycle = await cropCycles.create({ ...data, userId: req.user.id, farmId: farm.id, plotId: plot.id, observations: [] });
  res.status(201).json(cycleView(cycle));
}));

router.get('/:plotId/cycles/:cycleId', handle(async (req, res) => {
  const { cycle } = await loadCycle(req, res);
  if (!cycle) return;
  res.json(cycleView(cycle));
}));

router.patch('/:plotId/cycles/:cycleId', handle(async (req, res) => {
  const { plot, cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const { set, errors, conflict: why } = planCycleUpdate(cycle, req.body);
  if (why) return conflict(res, why, { code: 'INVALID_TRANSITION' });
  if (errors.length) return badRequest(res, errors);
  if (!Object.keys(set).length) return res.json(cycleView(cycle));
  // Crop, season or date changes make advice computed for the old values stale.
  const agronomic = ['crop', 'season', 'plannedSowingDate', 'sowingDate'].some((k) => k in set);
  const updated = await cropCycles.update(req.user.id, plot.id, cycle.id, { set, inc: agronomic ? { revision: 1 } : {} });
  if (!updated) return notFound(res, 'Crop cycle');
  res.json(cycleView(updated));
}));

router.get('/:plotId/cycles/:cycleId/observations', handle(async (req, res) => {
  const { limit, cursor, errors } = pageParams(req.query);
  if (errors.length) return badRequest(res, errors);
  const { cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const page = pageObservations(cycle.observations, { limit, cursor });
  if (!page) return badRequest(res, ['cursor is not valid']);
  res.json(page);
}));

router.post('/:plotId/cycles/:cycleId/observations', handle(async (req, res) => {
  const { plot, cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const { obs, errors } = sanitizeObservation(req.body);
  if (errors.length) return badRequest(res, errors);
  const updated = await cropCycles.addObservation(req.user.id, plot.id, cycle.id, obs, MAX_OBSERVATIONS);
  if (updated === 'FULL') return conflict(res, `A crop cycle can hold at most ${MAX_OBSERVATIONS} observations.`, { code: 'OBSERVATION_LIMIT' });
  if (!updated) return notFound(res, 'Crop cycle');
  res.status(201).json(obs);
}));

router.delete('/:plotId/cycles/:cycleId/observations/:obsId', handle(async (req, res) => {
  const { plot, cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const removed = await cropCycles.removeObservation(req.user.id, plot.id, cycle.id, String(req.params.obsId));
  if (!removed) return notFound(res, 'Observation');
  res.json({ success: true, deleted: String(req.params.obsId) });
}));

// Cultivation Plan: recommendations, crop selection, advice and calendars of one plot.
router.use('/:plotId', plotPlanRouter);

export default router;
