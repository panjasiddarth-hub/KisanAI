// src/routes/calendar.routes.js — /api/calendar/* — AI crop season planner
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { plans } from '../repositories/store.js';
import { cropRule } from '../agents/fertilizerAgent.js';
import { aiExplain } from '../agents/gemini.js';
import { CROPS } from '../data/crops.js';

const router = Router();

const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, days) => fmt(new Date(new Date(dateStr).getTime() + days * 86400000));

function seasonOf(dateStr) {
  const m = new Date(dateStr).getMonth() + 1;
  if (m >= 6 && m <= 10) return 'kharif';
  if (m >= 11 || m <= 3) return 'rabi';
  return 'zaid';
}

function generateTimeline({ crop, sowingDate, areaAcres = 1 }) {
  const meta = CROPS.find(c => c.name.toLowerCase() === crop.toLowerCase());
  const [dMin, dMax] = meta?.duration || [90, 120];
  const events = [];
  const ev = (offset, title, type, notes = '', agent = 'calendar-agent') =>
    events.push({ date: addDays(sowingDate, offset), title, type, notes, agent, done: false });

  // Land prep & sowing
  ev(-7, 'Land preparation — deep ploughing', 'prep', 'Apply FYM @ 2 t/acre and mix into soil.');
  ev(-1, 'Seed treatment', 'prep', 'Treat seed with bio-fertilizer / recommended fungicide tonight.');
  ev(0, `Sowing — ${crop}`, 'sowing', `Sow ${crop} at recommended spacing. Soil should have good moisture.`);

  // Fertilizer split events — straight from the Fertilizer Agent (multi-agent pipeline!)
  const rule = cropRule(crop);
  for (const [stage, dayOffset] of rule.splits) {
    if (dayOffset === 0) ev(0, `Basal fertilizer dose (${stage})`, 'fertilizer', 'Full DAP + MOP, and the basal share of urea. See Fertilizer Agent for exact kg.', 'fertilizer-agent');
    else ev(dayOffset, `Top-dressing — ${stage}`, 'fertilizer', 'Apply split nitrogen (urea) when soil is moist; see Fertilizer Agent for kg.', 'fertilizer-agent');
  }

  // Irrigation rhythm (skip if rainfed-aligned low-water crops is too complex — keep generic 18-22d rhythm)
  for (let d = 12; d < dMin - 10; d += 21) ev(d, `Irrigation (day ${d})`, 'irrigation', 'Light, even irrigation. Skip if >25 mm rain in last 48h.');

  // Weeding + pest scouting
  ev(18, 'First weeding / hoeing', 'weeding', 'Critical weed-free window starts now.');
  ev(35, 'Pest scouting walk', 'pest', 'Check 10 random plants. Upload any damaged leaf photo to the Disease Agent.', 'disease-agent');
  ev(50, 'Second pest & disease scouting', 'pest', 'Look under leaves for eggs/larvae; act only above economic threshold.', 'disease-agent');
  if (dMin > 110) ev(Math.round(dMin * 0.6), 'Mid-season nutrient check', 'task', 'Yellowing mid-season leaves usually signals N hunger — review top-dressing.');

  // Harvest
  ev(dMin - 8, 'Pre-harvest check', 'harvest', 'Check maturity signs; stop irrigation as advised for this crop.');
  ev(dMin, `Harvest window begins (${dMin}–${dMax} days)`, 'harvest', 'Harvest in dry morning hours for best quality.');

  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events, harvestWindow: `${addDays(sowingDate, dMin)} → ${addDays(sowingDate, dMax)}` };
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json({ plans: await plans.list(req.userId) }); } catch (e) { next(e); }
});

router.post('/generate', async (req, res, next) => {
  try {
    const { crop, sowingDate, areaAcres = 1, farmName = 'My Farm' } = req.body || {};
    if (!crop?.trim()) return res.status(400).json({ error: 'crop is required' });
    if (!sowingDate || isNaN(new Date(sowingDate))) return res.status(400).json({ error: 'valid sowingDate (YYYY-MM-DD) is required' });

    const season = seasonOf(sowingDate);
    const { events, harvestWindow } = generateTimeline({ crop: crop.trim(), sowingDate, areaAcres: Number(areaAcres) || 1 });
    const plan = await plans.create({
      userId: req.userId, crop: crop.trim(), sowingDate,
      areaAcres: Number(areaAcres) || 1, season, farmName, harvestWindow, events,
    });
    const explanation = (await aiExplain('calendar', plan))
      || `Your ${crop} plan runs from ${sowingDate} (sowing) to about ${harvestWindow.split(' → ')[1]} (harvest). The season is auto-detected as ${season}. The first fortnight is critical: land prep, seed treatment, sowing and basal fertilizer are all scheduled — don't slip on these. Fertilizer top-dressing dates below come straight from the Fertilizer Agent, and pest-scouting reminders will nudge you to use the Disease Agent.`;
    res.status(201).json({ plan, explanation });
  } catch (e) { next(e); }
});

router.patch('/:id/events/:index', async (req, res, next) => {
  try {
    const plan = await plans.setEventDone(req.userId, req.params.id, Number(req.params.index), req.body?.done);
    if (!plan) return res.status(404).json({ error: 'Plan or event not found' });
    res.json({ plan });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await plans.remove(req.userId, req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

export default router;
