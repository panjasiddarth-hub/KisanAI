// src/routes/plotPlan.routes.js — a plot's Cultivation Plan (Milestone 4).
// Mounted at /api/farms/:farmId/plots/:plotId (auth from the farms router). Every handler loads the
// farm by (owner, farmId), the plot by (owner, farmId, plotId) and any cycle by (owner, plotId, cycleId).
//
//   POST   /recommendations                         run + store a recommendation for this plot
//   GET    /recommendations?limit&cursor            history (newest first) with stale flags
//   POST   /recommendations/:recId/select           confirm a shortlisted crop → creates the crop cycle
//   GET    /plan                                    cycle, latest recommendation, calendar, advice + stale flags
//   POST   /assess                                  explicit (re)assessment: fertilizer / irrigation / market
//   POST   /cycles/:cycleId/calendar                create the cycle's calendar (idempotent)
//   POST   /cycles/:cycleId/calendar/regenerate     rebuild for new dates; keeps event ids + ticks
//   PATCH  /cycles/:cycleId/calendar/events/:eventId   tick / untick by stable event id
import { Router } from 'express';
import {
  farms, plots, cropCycles, recommendations, plotRecommendations, plotPlans, assessments, StoreConflict,
} from '../database/repositories/store.js';
import { ASSESSMENT_AGENTS } from '../database/models/Assessment.js';
import { isDate, todayStr, addDaysStr } from '../services/validation.js';
import { sanitizeCycleCreate, cycleView, plotView, farmBrief } from '../services/plotService.js';
import { hasConfirmedLocation } from '../services/farmContext.js';
import {
  recommendForPlot, runAssessment, assessmentState, recommendationState, calendarState, buildCycleTimeline, cycleDate,
} from '../services/plotAdvice.js';

const router = Router({ mergeParams: true });
const isObjectId = (s) => typeof s === 'string' && /^[a-f0-9]{24}$/i.test(s);

const handle = (fn) => async (req, res, next) => {
  try { await fn(req, res); } catch (err) {
    if (err instanceof StoreConflict) return res.status(409).json({ error: err.message, code: err.code });
    next(err);
  }
};

async function loadPlot(req, res) {
  const farm = await farms.get(req.user.id, String(req.params.farmId));
  if (!farm) { res.status(404).json({ error: 'Farm not found' }); return {}; }
  const plot = await plots.get(req.user.id, farm.id, String(req.params.plotId));
  if (!plot) { res.status(404).json({ error: 'Plot not found' }); return {}; }
  return { farm, plot };
}
async function loadCycle(req, res) {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return {};
  const cycle = await cropCycles.get(req.user.id, plot.id, String(req.params.cycleId));
  if (!cycle) { res.status(404).json({ error: 'Crop cycle not found' }); return {}; }
  return { farm, plot, cycle };
}
const withRecState = (rec, plot) => rec && { ...rec, ...recommendationState(rec, plot) };

// ---- Recommendations ---------------------------------------------------------------------------
router.post('/recommendations', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  if (plot.status !== 'active') return res.status(409).json({ error: 'This plot is archived. Restore it first.', code: 'PLOT_ARCHIVED' });
  const date = req.body?.plannedSowingDate;
  if (!isDate(date) || date < addDaysStr(todayStr(), -60) || date > addDaysStr(todayStr(), 365)) {
    return res.status(400).json({ error: 'plannedSowingDate must be a real date between 60 days ago and one year ahead', details: ['plannedSowingDate'] });
  }
  const result = await recommendForPlot({ farm, plot, plannedSowingDate: date });
  const saved = await recommendations.create({
    userId: req.user.id, farmId: farm.id, plotId: plot.id, plotRevision: plot.inputsRevision || 1, ...result,
  });
  res.status(201).json(withRecState(saved, plot));
}));

router.get('/recommendations', handle(async (req, res) => {
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  const cursor = req.query.cursor || null;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50 || (cursor && !isObjectId(cursor))) {
    return res.status(400).json({ error: 'limit must be 1–50 and cursor a valid id' });
  }
  const { plot } = await loadPlot(req, res);
  if (!plot) return;
  const page = await plotRecommendations.listForPlot(req.user.id, plot.id, { limit, cursor });
  res.json({ items: page.items.map((r) => withRecState(r, plot)), nextCursor: page.nextCursor });
}));

// Selecting a crop creates the plot's crop cycle — only with explicit confirmation, from a current
// (not stale) recommendation, for a shortlisted crop; one open cycle per plot (database rule).
router.post('/recommendations/:recId/select', handle(async (req, res) => {
  const { plot } = await loadPlot(req, res);
  if (!plot) return;
  const rec = await plotRecommendations.get(req.user.id, plot.id, String(req.params.recId));
  if (!rec) return res.status(404).json({ error: 'Recommendation not found for this plot' });
  const item = (rec.shortlist || []).find((s) => s.crop === req.body?.crop);
  if (!item) return res.status(400).json({ error: "crop must be one of this recommendation's shortlisted crops" });
  const state = recommendationState(rec, plot);
  if (state.stale) return res.status(409).json({ error: `This recommendation is out of date: ${state.reasons.join('; ')}. Get a new recommendation first.`, code: 'STALE_RECOMMENDATION' });
  const plannedSowingDate = req.body?.plannedSowingDate || rec.plannedSowingDate;
  const { data, errors } = sanitizeCycleCreate({ crop: item.calendarCrop || item.displayName || item.crop, plannedSowingDate, status: 'planned' }, plot);
  if (errors.length) return res.status(400).json({ error: errors.join('; '), details: errors });
  const preview = {
    plot: { id: plot.id, name: plot.name }, crop: data.crop, cropKey: data.cropKey, season: data.season, plannedSowingDate: data.plannedSowingDate,
    status: 'planned', source: 'recommendation', recommendationId: rec.id,
  };
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: 'Confirmation required: this creates a crop cycle for the plot. Send confirm: true to proceed.', code: 'CONFIRMATION_REQUIRED', preview });
  }
  const cycle = await cropCycles.create({
    ...data, source: 'recommendation', recommendationId: rec.id,
    userId: req.user.id, farmId: plot.farmId, plotId: plot.id, observations: [],
  });
  const recommendation = await plotRecommendations.markSelected(req.user.id, plot.id, rec.id, item.crop, cycle.id);
  res.status(201).json({ cycle: cycleView(cycle), recommendation: withRecState(recommendation, plot) });
}));

// ---- Plan overview -----------------------------------------------------------------------------
router.get('/plan', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  const [open, recPage] = await Promise.all([cropCycles.findOpen(req.user.id, plot.id), plotRecommendations.listForPlot(req.user.id, plot.id, { limit: 1 })]);
  const [calendar, ...latest] = await Promise.all([
    open ? plotPlans.findForCycle(req.user.id, open.id) : null,
    ...ASSESSMENT_AGENTS.map((a) => assessments.latest(req.user.id, plot.id, a)),
  ]);
  const advice = Object.fromEntries(ASSESSMENT_AGENTS.map((a, i) => {
    const doc = latest[i] && open && latest[i].cropCycleId === open.id ? latest[i] : null;
    return [a, doc ? { ...doc, ...assessmentState(doc, plot, open) } : { assessed: false, stale: false, reasons: [] }];
  }));
  res.json({
    farm: { ...farmBrief(farm), location: farm.location, locationConfirmed: hasConfirmedLocation(farm) },
    plot: plotView(plot),
    cycle: open ? cycleView(open, { observations: 'none' }) : null,
    recommendation: withRecState(recPage.items[0] || null, plot),
    calendar: calendar ? { ...calendar, ...calendarState(calendar, open) } : null,
    advice,
  });
}));

// ---- Explicit assessment -----------------------------------------------------------------------
router.post('/assess', handle(async (req, res) => {
  const { farm, plot } = await loadPlot(req, res);
  if (!plot) return;
  const wanted = req.body?.agents === undefined ? ASSESSMENT_AGENTS : req.body.agents;
  if (!Array.isArray(wanted) || !wanted.length || wanted.some((a) => !ASSESSMENT_AGENTS.includes(a))) {
    return res.status(400).json({ error: `agents must be a non-empty list of: ${ASSESSMENT_AGENTS.join(', ')}` });
  }
  const cycle = await cropCycles.findOpen(req.user.id, plot.id);
  if (!cycle) return res.status(409).json({ error: 'This plot has no planned or active crop cycle. Select a crop first.', code: 'NO_ACTIVE_CYCLE' });
  const [plan, recPage] = await Promise.all([plotPlans.findForCycle(req.user.id, cycle.id), plotRecommendations.listForPlot(req.user.id, plot.id, { limit: 1 })]);
  const fullCycle = await cropCycles.get(req.user.id, plot.id, cycle.id);
  const runs = await Promise.all([...new Set(wanted)].map((agent) => runAssessment({
    userId: req.user.id, farm, plot, cycle: fullCycle, plan, latestRecommendation: recPage.items[0] || null, agent,
  })));
  const saved = await Promise.all(runs.map((r) => assessments.create(r)));
  res.status(201).json({ advice: Object.fromEntries(saved.map((a) => [a.agent, { ...a, ...assessmentState(a, plot, fullCycle) }])) });
}));

// ---- Calendar (one per crop cycle) -------------------------------------------------------------
router.post('/cycles/:cycleId/calendar', handle(async (req, res) => {
  const { farm, plot, cycle } = await loadCycle(req, res);
  if (!cycle) return;
  if (!cycle.isOpen) return res.status(409).json({ error: `This crop cycle is ${cycle.status}; calendars are created for planned or active cycles.`, code: 'CYCLE_CLOSED' });
  const existing = await plotPlans.findForCycle(req.user.id, cycle.id);
  if (existing) return res.json({ plan: { ...existing, ...calendarState(existing, cycle) }, created: false });
  const t = buildCycleTimeline(cycle, plot);
  const { plan, created } = await plotPlans.createForCycle({
    userId: req.user.id, farmId: farm.id, plotId: plot.id, cropCycleId: cycle.id, crop: t.crop, sowingDate: t.sowingDate,
    areaAcres: plot.areaAcres || 1, season: cycle.season, farmName: farm.name, plotName: plot.name,
    harvestWindow: t.harvestWindow, events: t.events, recommendationId: cycle.recommendationId || undefined,
    basis: { crop: t.crop, sowingDate: t.sowingDate, cycleRevision: cycle.revision || 1, generatedAt: new Date() },
  });
  res.status(created ? 201 : 200).json({ plan: { ...plan, ...calendarState(plan, cycle) }, created, warnings: t.warnings || [] });
}));

router.post('/cycles/:cycleId/calendar/regenerate', handle(async (req, res) => {
  const { plot, cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const existing = await plotPlans.findForCycle(req.user.id, cycle.id);
  if (!existing) return res.status(404).json({ error: 'This crop cycle has no calendar yet' });
  const t = buildCycleTimeline(cycle, plot, existing.events || []);
  const plan = await plotPlans.replaceTimeline(req.user.id, cycle.id, {
    crop: t.crop, sowingDate: t.sowingDate, harvestWindow: t.harvestWindow, events: t.events,
    basis: { crop: t.crop, sowingDate: t.sowingDate, cycleRevision: cycle.revision || 1, generatedAt: new Date() },
  });
  res.json({ plan: { ...plan, ...calendarState(plan, cycle) }, preservedEvents: t.preserved, totalEvents: t.events.length });
}));

router.patch('/cycles/:cycleId/calendar/events/:eventId', handle(async (req, res) => {
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ error: 'done must be true or false' });
  const { cycle } = await loadCycle(req, res);
  if (!cycle) return;
  const plan = await plotPlans.setEventDone(req.user.id, cycle.id, String(req.params.eventId), req.body.done);
  if (!plan) return res.status(404).json({ error: 'Event not found in this crop cycle’s calendar' });
  res.json({ planId: plan.id, event: plan.events.find((e) => e.id === String(req.params.eventId)) });
}));

export { cycleDate };
export default router;
