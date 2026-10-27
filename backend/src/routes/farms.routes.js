// src/routes/farms.routes.js
import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { farms } from '../database/repositories/store.js';
import { pickAllowedFields } from '../utils/requestFields.js';
import { validateFarmPayload } from '../utils/farmValidation.js';
import { cleanSoilExtraction, verifiedSoilReportMime } from '../utils/soilReport.js';
import { extractSoilReport } from '../agents/gemini.js';

const router = Router();
router.use(requireAuth);

const soilReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!['application/pdf', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      const error = new Error('Upload a PDF, JPG, PNG, or WebP soil report.');
      error.status = 415;
      return callback(error);
    }
    callback(null, true);
  },
});

const EDITABLE_FARM_FIELDS = [
  'name', 'location', 'farmerName', 'farmerPhone', 'village', 'district', 'state',
  'latitude', 'longitude',
  'area', 'areaUnit', 'landOwnership', 'soilType', 'soilPH', 'soilEC', 'soilOC',
  'soilN', 'soilP', 'soilK', 'soilS', 'soilZn', 'soilB', 'soilFe', 'soilCu', 'soilMn',
  'soilSources', 'soilTestDate', 'waterSource', 'waterAvailability', 'irrigationMethods',
  'waterQuality', 'crops', 'season', 'previousCrop', 'cultivationMethod', 'images',
];

router.get('/', async (req, res, next) => {
  try {
    const list = await farms.list(req.user.id);
    res.json(list);
  } catch (e) { next(e); }
});

router.post('/soil-report/extract', soilReportUpload.single('report'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a soil report file to scan.' });
    const mimeType = verifiedSoilReportMime(req.file.buffer);
    if (!mimeType) {
      return res.status(415).json({ error: 'The uploaded file is not a supported PDF or image.' });
    }
    const consented = req.body?.consentToAIProcessing === 'true';
    const geminiFallback = async () => {
      if (!consented) {
        return res.status(422).json({ error: 'This report has no readable selectable text. To scan a photo or scanned PDF, check consent to send it to Gemini, or enter the readings manually.' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(503).json({ error: 'Gemini scanning is not configured. You can still enter report values manually.' });
      }
      const extraction = await extractSoilReport(req.file.buffer, mimeType);
      if (!extraction || typeof extraction !== 'object' || Array.isArray(extraction)) {
        return res.status(502).json({ error: 'Gemini returned no structured soil data. Check the backend terminal and try again.' });
      }
      const cleaned = cleanSoilExtraction(extraction);
      const hasMeasurement = Object.entries(cleaned).some(([field, item]) => field !== 'soilTestDate' && item?.value !== null);
      if (!hasMeasurement) {
        return res.status(422).json({ error: 'The file was received, but no soil measurements were readable. Check that the report values are visible and labeled with their units, or enter them manually.' });
      }
      return res.json({ extraction: cleaned, stored: false, reviewRequired: true, extractionMethod: 'gemini_vision' });
    };

    if (mimeType !== 'application/pdf') {
      return await geminiFallback();
    }

    let localResult;
    try {
      const mlServiceUrl = (process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
      const form = new FormData();
      form.append('report', new Blob([req.file.buffer], { type: 'application/pdf' }), 'soil-report.pdf');
      const response = await fetch(`${mlServiceUrl}/extract/soil-report/pdf`, { method: 'POST', body: form, signal: AbortSignal.timeout(10000) });
      if (response.ok) localResult = await response.json();
    } catch {
      // If local extraction is unavailable, only use Gemini after explicit consent.
    }
    if (localResult?.textAvailable && localResult?.hasReadings) {
      const cleaned = cleanSoilExtraction(localResult.extraction);
      const hasMeasurement = Object.entries(cleaned).some(([field, item]) => field !== 'soilTestDate' && item?.value !== null);
      if (hasMeasurement) return res.json({ extraction: cleaned, stored: false, reviewRequired: true, extractionMethod: 'local_pdf_text' });
    }
    return await geminiFallback();
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const input = pickAllowedFields(req.body, EDITABLE_FARM_FIELDS);
    const validation = validateFarmPayload(input);
    if (validation.errors.length) {
      return res.status(400).json({ error: 'Invalid farm details', details: validation.errors });
    }
    const farm = await farms.create({ ...validation.data, userId: req.user.id });
    res.status(201).json(farm);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, EDITABLE_FARM_FIELDS);
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable farm fields supplied' });
    }
    const validation = validateFarmPayload(updates, { partial: true });
    if (validation.errors.length) {
      return res.status(400).json({ error: 'Invalid farm details', details: validation.errors });
    }
    const updated = await farms.update(req.user.id, req.params.id, validation.data);
    if (!updated) return res.status(404).json({ error: 'Farm not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await farms.remove(req.user.id, req.params.id);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Farm not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
