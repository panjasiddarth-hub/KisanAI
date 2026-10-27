// src/routes/calendar.routes.js — /api/calendar/* — draft crop season planner
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { farms, plans } from '../database/repositories/store.js';
import { aiExplain } from '../agents/gemini.js';
import { CROPS } from '../data/crops.js';
import { validateCalendarEventUpdate, validateCalendarPayload } from '../utils/calendarValidation.js';

const router = Router();

const fmt = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, days) => fmt(new Date(new Date(dateStr).getTime() + days * 86400000));

function seasonOf(dateStr) {
  const m = new Date(dateStr).getMonth() + 1;
  if (m >= 6 && m <= 10) return 'kharif';
  if (m >= 11 || m <= 3) return 'rabi';
  return 'zaid';
}

export function generateTimeline({ crop, sowingDate }) {
  const meta = CROPS.find(c => c.name.toLowerCase() === crop.toLowerCase());
  const [dMin, dMax] = meta?.duration || [90, 120];
  const events = [];
  const ev = (offset, title, type, notes = '', agent = 'calendar-agent') =>
    events.push({ date: addDays(sowingDate, offset), title, type, notes, agent, done: false });

  // Land prep & sowing
  ev(-7, 'Prepare the field', 'prep', 'Use local agriculture guidance. Check your soil report before applying soil amendments.');
  ev(-1, 'Prepare seed for sowing', 'prep', 'Use quality seed and confirm any crop-specific seed treatment with local agriculture staff.');
  ev(0, `Sowing — ${crop}`, 'sowing', `Sow ${crop} at locally recommended spacing and depth; check soil moisture.`);

  // This timeline does not invent fertilizer doses or crop-specific application dates.
  ev(-2, 'Confirm fertilizer plan before application', 'task', 'Use the recommendation on your official Soil Health Card or ask a local agronomist. This calendar has not calculated a fertilizer dose or schedule.');

  // Remind the farmer to assess field conditions instead of imposing a fixed water interval.
  for (let d = 12; d < dMin - 10; d += 21) {
    ev(d, 'Check soil moisture and local weather', 'irrigation', 'This is a check-in reminder, not a fixed irrigation instruction. Decide whether to irrigate from crop stage, field moisture and local guidance.');
  }

  // Weeding + pest scouting
  ev(18, 'First weeding / hoeing', 'weeding', 'Critical weed-free window starts now.');
  ev(35, 'Pest scouting walk', 'pest', 'Check 10 random plants for pests or disease symptoms.');
  ev(50, 'Second pest & disease scouting', 'pest', 'Look under leaves for eggs/larvae; ask an agronomist to confirm a diagnosis.');
  if (dMin > 110) ev(Math.round(dMin * 0.6), 'Review crop progress', 'task', 'Check the crop and contact local agriculture staff if you notice a problem. This reminder does not diagnose nutrient deficiency.');

  // Harvest
  ev(dMin - 8, 'Check crop maturity', 'harvest', 'The calendar uses a general crop-duration estimate. Confirm maturity and harvest timing with local guidance.');
  ev(dMin, `Estimated harvest window begins (${dMin}–${dMax} days)`, 'harvest', 'This is an estimate based on general crop duration, not a prediction for this specific field.');

  events.sort((a, b) => a.date.localeCompare(b.date));
  return { events, harvestWindow: `${addDays(sowingDate, dMin)} → ${addDays(sowingDate, dMax)}` };
}

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try { res.json({ plans: await plans.list(req.userId) }); } catch (e) { next(e); }
});

router.post('/generate', async (req, res, next) => {
  try {
    const validation = validateCalendarPayload(req.body, CROPS.map((item) => item.name));
    if (validation.errors.length) {
      return res.status(400).json({ error: 'Invalid calendar request', details: validation.errors });
    }
    const { crop, sowingDate, areaAcres } = validation.data;
    let farm = null;
    if (validation.data.farmId) {
      farm = await farms.get(req.userId, validation.data.farmId);
      if (!farm) return res.status(404).json({ error: 'Selected farm was not found for this account.' });
    }

    const season = seasonOf(sowingDate);
    const { events, harvestWindow } = generateTimeline({ crop: crop.trim(), sowingDate });
    const plan = await plans.create({
      userId: req.userId, crop: crop.trim(), sowingDate,
      areaAcres: Number(areaAcres) || 1, season,
      farmId: farm?.id || '', farmName: farm?.name || validation.data.farmName,
      harvestWindow, events,
    });
    const explanation = (await aiExplain('calendar', plan))
      || `This is a draft ${crop} planning calendar with preparation, sowing, field check-ins and a general crop-duration harvest estimate. Fertilizer doses and application timing have not been calculated; use the Soil Health Card or local agronomist guidance.`;
    res.status(201).json({ plan, explanation });
  } catch (e) { next(e); }
});

router.patch('/:id/events/:index', async (req, res, next) => {
  try {
    const eventIndex = Number(req.params.index);
    const issues = validateCalendarEventUpdate(req.body, eventIndex);
    if (issues.length) return res.status(400).json({ error: 'Invalid calendar update', details: issues });
    const plan = await plans.updateEvent(req.userId, req.params.id, eventIndex, req.body);
    if (!plan) return res.status(404).json({ error: 'Plan or event not found' });
    res.json({ plan });
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try { await plans.remove(req.userId, req.params.id); res.json({ ok: true }); } catch (e) { next(e); }
});

export default router;
