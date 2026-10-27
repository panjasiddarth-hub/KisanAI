// Prediction endpoints call the trained models in the Python ML service.
// There is deliberately no rule-based prediction fallback.
import { Router } from 'express';
import multer from 'multer';
import { aiExplain } from '../agents/gemini.js';
import { SYMPTOMS } from '../data/diseases.js';
import { SOIL_TYPES, SEASONS, CROPS } from '../data/crops.js';
import { requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateAgentInput } from '../agents/validationAgent.js';
import { isAllowedDiseaseImage } from '../utils/imageValidation.js';
import { farms } from '../database/repositories/store.js';
import { getGeneralFertilizerRequirements, getOfficialCropsForState, getPersonalizedFertilizerRecommendation, isShcConfigured } from '../services/soilHealthCard.js';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5, parts: 6 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png'].includes(file.mimetype)) {
      const error = new Error('Only JPEG or PNG images are accepted.');
      error.status = 415;
      return callback(error);
    }
    return callback(null, true);
  },
});
const predictionRateLimit = createRateLimiter({ name: 'predictions', windowMs: 15 * 60 * 1000, limit: 30 });

async function callML(endpoint, body) {
  let response;
  try {
    response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const unavailable = new Error(`ML service unavailable at ${ML_SERVICE_URL}: ${error.message}`);
    unavailable.status = 503;
    throw unavailable;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error(result.detail || result.error || `ML service returned ${response.status}`);
    failure.status = response.status;
    throw failure;
  }
  return result;
}

router.get('/meta', async (_req, res) => {
  let diseaseModelAvailable = false;
  let knowledgeAssistantAvailable = false;
  let knowledgeAssistantStatus = 'Paused until the ML service reports a recently reviewed official-source corpus.';
  try {
    const health = await fetch(`${ML_SERVICE_URL}/health`, { signal: AbortSignal.timeout(1500) });
    const status = await health.json();
    diseaseModelAvailable = health.ok && status.models?.disease === 'available';
    knowledgeAssistantAvailable = health.ok && status.models?.rag === 'available' && status.models?.ragCorpusVerified === true;
    if (knowledgeAssistantAvailable) knowledgeAssistantStatus = status.models?.ragDetails?.detail || 'Verified source retrieval is available.';
    else if (health.ok && typeof status.models?.rag === 'string') knowledgeAssistantStatus = status.models.rag;
  } catch { /* Keep the disease UI disabled while the ML service is offline. */ }
  res.json({
    soilTypes: SOIL_TYPES,
    seasons: SEASONS,
    irrigationModes: ['irrigated', 'rainfed'],
    crops: CROPS.map((crop) => crop.name),
    diseaseCrops: [],
    diseaseModelAvailable,
    knowledgeAssistantAvailable,
    knowledgeAssistantStatus,
    officialSoilHealthCardLookupAvailable: isShcConfigured(),
    symptoms: SYMPTOMS,
    geminiEnabled: !!process.env.GEMINI_API_KEY,
    mlService: ML_SERVICE_URL,
  });
});

router.post('/crop', requireAuth, predictionRateLimit, async (req, res, next) => {
  try {
    const input = req.body || {};
    const issues = validateAgentInput('crop', input);
    if (issues.length) return res.status(400).json({ error: 'Invalid crop model input', details: issues });
    const result = await callML('/predict/crop', {
      N: Number(input.N),
      P: Number(input.P),
      K: Number(input.K),
      temperature: Number(input.temperature),
      humidity: Number(input.humidity),
      ph: Number(input.ph),
      rainfall: Number(input.rainfall),
    });
    const explanation = await aiExplain('crop', result)
      || `The trained crop classifier selected ${result.prediction}. Its top model scores are shown below.`;
    res.json({
      ...result,
      explanation,
      explanationSource: process.env.GEMINI_API_KEY ? 'gemini' : 'model_summary',
      modelSource: 'crop_random_forest',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/fertilizer', requireAuth, predictionRateLimit, async (req, res, next) => {
  try {
    const input = req.body || {};
    const issues = validateAgentInput('fertilizer', input);
    if (issues.length) return res.status(400).json({ error: 'Invalid fertilizer model input', details: issues });
    const result = await callML('/predict/fertilizer', input);
    const explanation = await aiExplain('fertilizer', result)
      || 'These nutrient ratings are the trained model’s classification of the soil test values you supplied.';
    res.json({
      ...result,
      explanation,
      explanationSource: process.env.GEMINI_API_KEY ? 'gemini' : 'model_summary',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/fertilizer/reference', requireAuth, predictionRateLimit, async (req, res, next) => {
  try {
    const { farmId, crop, cropId } = req.body || {};
    if (typeof farmId !== 'string' || !farmId.trim() || farmId.length > 64) {
      return res.status(400).json({ error: 'Choose a saved farm with a state and district first.' });
    }
    if (typeof crop !== 'string' || !crop.trim() || crop.length > 80) {
      return res.status(400).json({ error: 'Crop must contain 1 to 80 characters.' });
    }
    if (cropId !== undefined && (typeof cropId !== 'string' || !cropId.trim() || cropId.length > 120)) {
      return res.status(400).json({ error: 'Choose a crop from the official regional crop list.' });
    }
    const farm = await farms.get(req.user.id, farmId);
    if (!farm) return res.status(404).json({ error: 'Saved farm not found.' });
    if (!farm.state?.trim()) return res.status(400).json({ error: 'Add the farm state before requesting an official fertilizer recommendation.' });

    if (typeof cropId === 'string' && cropId.trim()) {
      const npk = { N: farm.soilN, P: farm.soilP, K: farm.soilK };
      const missingSoilInputs = Object.entries(npk).filter(([, value]) => value === null || value === undefined || !Number.isFinite(Number(value))).map(([key]) => key);
      if (!missingSoilInputs.length) {
        const recommendation = await getPersonalizedFertilizerRecommendation({
          state: farm.state.trim(),
          cropId: cropId.trim(),
          cropName: crop.trim(),
          results: npk,
        });
        return res.json({ ...recommendation, location: { state: farm.state, district: farm.district || '' } });
      }
    }

    if (!farm.district?.trim()) {
      return res.status(400).json({ error: 'Add the farm district to request general regional guidance.', needsInput: ['district', 'soil N', 'soil P', 'soil K'] });
    }

    const missingSoilInputs = [['N', farm.soilN], ['P', farm.soilP], ['K', farm.soilK]]
      .filter(([, value]) => value === null || value === undefined || !Number.isFinite(Number(value)))
      .map(([nutrient]) => nutrient);
    const reference = await getGeneralFertilizerRequirements({
      state: farm.state.trim(),
      district: farm.district.trim(),
      crop: crop.trim(),
    });
    res.json({
      ...reference,
      personalized: false,
      missingSoilInputs,
      location: { state: farm.state, district: farm.district },
      crop: crop.trim(),
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/fertilizer/crops', requireAuth, predictionRateLimit, async (req, res, next) => {
  try {
    const { farmId } = req.body || {};
    if (typeof farmId !== 'string' || !farmId.trim() || farmId.length > 64) {
      return res.status(400).json({ error: 'Choose a saved farm with a state first.' });
    }
    const farm = await farms.get(req.user.id, farmId);
    if (!farm) return res.status(404).json({ error: 'Saved farm not found.' });
    if (!farm.state?.trim()) return res.status(400).json({ error: 'Add the farm state before loading official crop choices.' });
    const result = await getOfficialCropsForState(farm.state.trim());
    res.json(result);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
});

router.post('/disease', requireAuth, predictionRateLimit, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload a clear JPEG or PNG leaf photo.' });
    if (!isAllowedDiseaseImage(req.file)) {
      return res.status(415).json({ error: 'Image contents must match a JPEG or PNG file.' });
    }
    const form = new FormData();
    form.append('image', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'leaf-image');
    const result = await fetch(`${ML_SERVICE_URL}/predict/disease`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const prediction = await result.json().catch(() => ({}));
    if (!result.ok) {
      const error = new Error(prediction.detail || prediction.error || `ML service returned ${result.status}`);
      error.status = result.status;
      throw error;
    }
    return res.json(prediction);
  } catch (error) {
    next(error);
  }
});

export default router;
