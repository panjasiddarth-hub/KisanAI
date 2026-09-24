// src/routes/agents.routes.js — /api/agents/*
// ML-powered crop recommendation + rule-engine fallback
// Fertilizer and disease routes remain on the existing implementations for now.

import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';

import { suggestCrops, templateExplanation } from '../agents/cropAgent.js';
import { fertilizePlan, fertilizerExplanation } from '../agents/fertilizerAgent.js';
import { diagnose, diseaseExplanation } from '../agents/diseaseAgent.js';
import { aiExplain, aiAnalyzeImage } from '../agents/gemini.js';

import { SYMPTOMS, DISEASE_DB } from '../data/diseases.js';
import { SOIL_TYPES, SEASONS, CROPS } from '../data/crops.js';

const router = Router();

// ============================================================
// ML SERVICE CONFIGURATION
// ============================================================

const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';


// ============================================================
// IMAGE UPLOAD CONFIGURATION
// ============================================================

const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (_req, file, cb) =>
      cb(
        null,
        `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}${path.extname(file.originalname)}`
      ),
  }),

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});


// ============================================================
// META INFORMATION
// ============================================================

router.get('/meta', (_req, res) => {
  res.json({
    soilTypes: SOIL_TYPES,

    seasons: SEASONS,

    irrigationModes: [
      'irrigated',
      'rainfed',
    ],

    crops: CROPS.map((c) => c.name),

    diseaseCrops: Object.keys(DISEASE_DB),

    symptoms: SYMPTOMS,

    geminiEnabled: !!process.env.GEMINI_API_KEY,

    mlService: ML_SERVICE_URL,
  });
});


// ============================================================
// CROP RECOMMENDATION
// ============================================================
// Primary: Random Forest ML model through FastAPI
// Fallback: Existing rule engine
// ============================================================

router.post('/crop', async (req, res, next) => {
  try {
    const input = req.body || {};

    console.log('Crop request received:', input);

    // --------------------------------------------------------
    // 1. Try ML Service
    // --------------------------------------------------------

    try {
      const mlResponse = await fetch(
        `${ML_SERVICE_URL}/predict/crop`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            N: Number(input.N),
            P: Number(input.P),
            K: Number(input.K),

            temperature: Number(input.temperature),

            humidity: Number(input.humidity),

            ph: Number(input.ph),

            rainfall: Number(input.rainfall),
          }),
        }
      );

      // FastAPI validation/model error
      if (!mlResponse.ok) {
        const errorText = await mlResponse.text();

        throw new Error(
          `ML service returned ${mlResponse.status}: ${errorText}`
        );
      }

      const mlResult = await mlResponse.json();

      console.log(
        'Crop ML prediction:',
        mlResult
      );

      // ------------------------------------------------------
      // 2. Generate explanation
      // ------------------------------------------------------

      const explanation =
        (await aiExplain('crop', mlResult)) ||
        `Based on the soil and environmental conditions provided, the ML model recommends ${mlResult.prediction} as the top crop.`;

      // ------------------------------------------------------
      // 3. Return ML result
      // ------------------------------------------------------

      return res.json({
        ...mlResult,

        explanation,

        explanationSource:
          process.env.GEMINI_API_KEY
            ? 'gemini'
            : 'template',

        modelSource: 'crop_random_forest',
      });

    } catch (mlError) {

      // ------------------------------------------------------
      // ML SERVICE FAILED
      // Use existing rule engine as fallback
      // ------------------------------------------------------

      console.warn(
        'Crop ML service unavailable. Using rule-engine fallback.'
      );

      console.warn(
        'ML error:',
        mlError.message
      );

      const result = suggestCrops(input);

      if (result.error) {
        return res.status(400).json({
          error: result.error,
        });
      }

      const explanation =
        (await aiExplain('crop', result)) ||
        templateExplanation(result);

      return res.json({
        ...result,

        explanation,

        explanationSource:
          process.env.GEMINI_API_KEY
            ? 'gemini'
            : 'template',

        modelSource: 'rule_engine_fallback',
      });
    }

  } catch (e) {
    next(e);
  }
});


// ============================================================
// FERTILIZER RECOMMENDATION
// ============================================================
// Existing implementation for now.
// We will connect fertilizer.pkl separately.
// ============================================================

router.post('/fertilizer', async (req, res, next) => {
  try {
    const plan = fertilizePlan(req.body || {});

    if (plan.error) {
      return res.status(400).json({
        error: plan.error,
      });
    }

    const explanation =
      (await aiExplain('fertilizer', plan)) ||
      fertilizerExplanation(plan);

    res.json({
      ...plan,

      explanation,

      explanationSource:
        process.env.GEMINI_API_KEY
          ? 'gemini'
          : 'template',

      modelSource: 'rule_engine',
    });

  } catch (e) {
    next(e);
  }
});


// ============================================================
// DISEASE DETECTION
// ============================================================
// Existing symptom-based implementation + optional Gemini
// image analysis.
// ML disease model will be connected later.
// ============================================================

router.post(
  '/disease',
  upload.single('image'),
  async (req, res, next) => {

    try {

      // ------------------------------------------------------
      // Parse symptoms
      // ------------------------------------------------------

      let symptoms = [];

      const raw = req.body?.symptoms;

      if (Array.isArray(raw)) {

        symptoms = raw;

      } else if (typeof raw === 'string') {

        try {

          symptoms = JSON.parse(raw);

        } catch {

          symptoms = raw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }


      // ------------------------------------------------------
      // Existing disease diagnosis
      // ------------------------------------------------------

      const result = diagnose({
        crop: req.body?.crop,

        symptoms,

        hasPhoto: !!req.file,
      });


      if (result.error) {
        return res.status(400).json({
          error: result.error,
        });
      }


      // ------------------------------------------------------
      // Photo URL
      // ------------------------------------------------------

      if (req.file) {

        result.photoUrl =
          `/uploads/${req.file.filename}`;
      }


      // ------------------------------------------------------
      // Gemini Vision Analysis
      // ------------------------------------------------------

      if (
        req.file &&
        process.env.GEMINI_API_KEY
      ) {

        const visionAnalysis =
          await aiAnalyzeImage(
            req.body?.crop,
            req.file.path
          );

        if (visionAnalysis) {

          result.photoAnalysis =
            visionAnalysis;

          result.visionModelUsed =
            true;
        }
      }


      // ------------------------------------------------------
      // Explanation
      // ------------------------------------------------------

      const explanation =
        (await aiExplain('disease', result)) ||
        diseaseExplanation(result);


      // ------------------------------------------------------
      // Response
      // ------------------------------------------------------

      res.json({

        ...result,

        explanation,

        explanationSource:
          process.env.GEMINI_API_KEY
            ? 'gemini'
            : 'template',

        modelSource:
          result.visionModelUsed
            ? 'gemini_vision'
            : 'rule_engine',
      });

    } catch (e) {
      next(e);
    }
  }
);


// ============================================================
// EXPORT ROUTER
// ============================================================

export default router;