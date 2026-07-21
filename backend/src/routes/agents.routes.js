// src/routes/agents.routes.js — /api/agents/* (rule engine + optional Gemini explanation)
import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { suggestCrops, templateExplanation } from '../agents/cropAgent.js';
import { fertilizePlan, fertilizerExplanation } from '../agents/fertilizerAgent.js';
import { diagnose, diseaseExplanation } from '../agents/diseaseAgent.js';
import { aiExplain } from '../agents/gemini.js';
import { SYMPTOMS, DISEASE_DB } from '../data/diseases.js';
import { SOIL_TYPES, SEASONS, CROPS } from '../data/crops.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Public meta so the frontend can render forms from one source of truth
router.get('/meta', (_req, res) => {
  res.json({
    soilTypes: SOIL_TYPES,
    seasons: SEASONS,
    irrigationModes: ['irrigated', 'rainfed'],
    crops: CROPS.map(c => c.name),
    diseaseCrops: Object.keys(DISEASE_DB),
    symptoms: SYMPTOMS,
    geminiEnabled: !!process.env.GEMINI_API_KEY,
  });
});

router.post('/crop', async (req, res, next) => {
  try {
    const result = suggestCrops(req.body || {});
    if (result.error) return res.status(400).json({ error: result.error });
    const explanation = (await aiExplain('crop', result)) || templateExplanation(result);
    res.json({ ...result, explanation, explanationSource: process.env.GEMINI_API_KEY ? 'gemini' : 'template' });
  } catch (e) { next(e); }
});

router.post('/fertilizer', async (req, res, next) => {
  try {
    const plan = fertilizePlan(req.body || {});
    if (plan.error) return res.status(400).json({ error: plan.error });
    const explanation = (await aiExplain('fertilizer', plan)) || fertilizerExplanation(plan);
    res.json({ ...plan, explanation, explanationSource: process.env.GEMINI_API_KEY ? 'gemini' : 'template' });
  } catch (e) { next(e); }
});

// multipart: crop, symptoms (JSON array or comma list), image? (file)
router.post('/disease', upload.single('image'), async (req, res, next) => {
  try {
    let symptoms = [];
    const raw = req.body?.symptoms;
    if (Array.isArray(raw)) symptoms = raw;
    else if (typeof raw === 'string') {
      try { symptoms = JSON.parse(raw); } catch { symptoms = raw.split(',').map(s => s.trim()).filter(Boolean); }
    }
    const result = diagnose({ crop: req.body?.crop, symptoms, hasPhoto: !!req.file });
    if (result.error) return res.status(400).json({ error: result.error });
    if (req.file) result.photoUrl = `/uploads/${req.file.filename}`;
    const explanation = (await aiExplain('disease', result)) || diseaseExplanation(result);
    res.json({ ...result, explanation, explanationSource: process.env.GEMINI_API_KEY ? 'gemini' : 'template' });
  } catch (e) { next(e); }
});

export default router;
