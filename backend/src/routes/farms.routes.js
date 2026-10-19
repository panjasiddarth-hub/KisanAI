
// src/routes/farms.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { farms } from '../repositories/store.js';
import { CROPS, SEASONS } from '../data/crops.js';
import { CROP_SUITABILITY_WEIGHTS, suggestCrops } from '../agents/cropAgent.js';
import { fertilizePlan } from '../agents/fertilizerAgent.js';
import { readSoilReport } from '../services/soilReportReader.js';
import {
  deleteSoilReport,
  detectSoilReportType,
  MAX_SOIL_REPORT_BYTES,
  readSoilReport as readStoredSoilReport,
  saveSoilReport,
  soilReportUpload,
  soilReportUploadError,
} from '../services/soilReportStore.js';

const router = Router();
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:8000';
const PREFERENCE_BONUS = 5;

router.use(requireAuth);

// Normalize the authenticated identity for all farm routes.
// Never accept the farm owner ID from the request body.
router.use((req, res, next) => {
  const user = req.user;
  const authenticatedId = user && (
    user.id ??
    user._id ??
    user.userId ??
    user.sub ??
    user.user?.id ??
    user.user?._id ??
    user.user?.userId ??
    user.user?.sub
  );

  if (
    authenticatedId == null ||
    String(authenticatedId).trim() === ''
  ) {
    return res.status(401).json({
      error: 'Your login session does not contain a valid user ID. Please sign in again.',
    });
  }

  req.user.id = String(authenticatedId);
  next();
});

const FARM_FIELDS = new Set([
  'name', 'location', 'area', 'areaUnit', 'soilType', 'waterSource',
  'crops', 'profile', 'cropHistory', 'activities', 'coordinates',
  'soilTest', 'soilReport',
]);

const AREA_UNITS = new Set(['acres', 'hectares', 'bigha', 'other']);
const COORDINATE_SOURCES = new Set(['device', 'geocoded', 'manual']);
const SOIL_TEST_FIELDS = new Set([
  'N', 'P', 'K', 'ph', 'ec', 'oc', 's', 'zn', 'b', 'fe', 'cu', 'mn',
  'testedOn',
]);
const SOIL_REPORT_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
]);
const SOIL_REPORT_ID = /^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/;

function currentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 6 && month <= 10) return 'kharif';
  if (month >= 11 || month <= 3) return 'rabi';
  return 'zaid';
}

function farmPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Farm profile must be an object' };
  }

  if (Object.keys(body).some((key) => !FARM_FIELDS.has(key))) {
    return { error: 'Farm profile contains unsupported fields' };
  }

  if (JSON.stringify(body).length > 100_000) {
    return { error: 'Farm profile is too large' };
  }

  if (
    body.profile !== undefined &&
    (!body.profile || typeof body.profile !== 'object' ||
      Array.isArray(body.profile))
  ) {
    return { error: 'profile must be an object' };
  }

  if (
    body.profile?.cropHistory !== undefined &&
    !Array.isArray(body.profile.cropHistory)
  ) {
    return { error: 'profile.cropHistory must be an array' };
  }

  if (body.profile?.cropHistory?.length > 50) {
    return { error: 'profile.cropHistory cannot contain more than 50 items' };
  }

  for (const key of ['cropHistory', 'activities', 'crops']) {
    if (body[key] !== undefined && !Array.isArray(body[key])) {
      return { error: `${key} must be an array` };
    }
    if (Array.isArray(body[key]) && body[key].length > 50) {
      return { error: `${key} cannot contain more than 50 items` };
    }
  }

  const payload = structuredClone(body);
  const basic = payload.profile?.basic;

  if (payload.profile?.cropHistory && payload.cropHistory === undefined) {
    payload.cropHistory = payload.profile.cropHistory;
  }

  if (basic && typeof basic === 'object' && !Array.isArray(basic)) {
    payload.name ??= basic.name;
    payload.area ??= basic.area;
    payload.areaUnit ??= basic.areaUnit;
    payload.location ??= basic.locationLabel || [
      basic.village,
      basic.mandal,
      basic.district,
      basic.state,
      basic.pinCode,
    ].filter(Boolean).join(', ');

    payload.coordinates ??= basic.coordinates;

    if (payload.soilTest === undefined) {
      payload.soilTest = payload.profile?.soilTest;
    }

    if (payload.soilReport === undefined) {
      payload.soilReport = payload.profile?.soilReport !== undefined
        ? payload.profile.soilReport
        : basic.soilReport;
    }
  }

  if (
    payload.name !== undefined &&
    (typeof payload.name !== 'string' || payload.name.trim().length > 120)
  ) {
    return { error: 'name must be a string of at most 120 characters' };
  }

  if (
    payload.location !== undefined &&
    (typeof payload.location !== 'string' ||
      payload.location.trim().length > 300)
  ) {
    return { error: 'location must be a string of at most 300 characters' };
  }

  if (partial && payload.area === '') delete payload.area;

  if (
    payload.area !== undefined &&
    (!Number.isFinite(Number(payload.area)) || Number(payload.area) < 0)
  ) {
    return { error: 'area must be a non-negative number' };
  }

  if (payload.areaUnit !== undefined && !AREA_UNITS.has(payload.areaUnit)) {
    return { error: 'areaUnit must be acres, hectares, bigha, or other' };
  }

  if (payload.coordinates !== undefined) {
    const coordinates = payload.coordinates;

    if (coordinates === null) {
      payload.coordinates = null;
    } else if (
      !coordinates ||
      typeof coordinates !== 'object' ||
      Array.isArray(coordinates) ||
      coordinates.lat == null ||
      coordinates.lat === '' ||
      coordinates.lon == null ||
      coordinates.lon === '' ||
      !Number.isFinite(Number(coordinates.lat)) ||
      Math.abs(Number(coordinates.lat)) > 90 ||
      !Number.isFinite(Number(coordinates.lon)) ||
      Math.abs(Number(coordinates.lon)) > 180 ||
      !COORDINATE_SOURCES.has(coordinates.source) ||
      (coordinates.label !== undefined &&
        (typeof coordinates.label !== 'string' ||
          coordinates.label.length > 300))
    ) {
      return {
        error: 'coordinates must include valid latitude, longitude, and source values',
      };
    } else {
      payload.coordinates = {
        lat: Number(coordinates.lat),
        lon: Number(coordinates.lon),
        source: coordinates.source,
        label: coordinates.label || '',
        confirmedAt: new Date(),
      };
    }
  }

  if (payload.soilTest !== undefined && payload.soilTest !== null) {
    if (
      typeof payload.soilTest !== 'object' ||
      Array.isArray(payload.soilTest) ||
      Object.keys(payload.soilTest).some(
        (key) => !SOIL_TEST_FIELDS.has(key),
      )
    ) {
      return { error: 'soilTest contains unsupported values' };
    }

    const soilTest = {};

    for (const [key, value] of Object.entries(payload.soilTest)) {
      if (key === 'testedOn') {
        if (typeof value !== 'string' || value.length > 40) {
          return { error: 'soilTest.testedOn must be a date string' };
        }
        soilTest.testedOn = value;
      } else {
        if (value == null || value === '') {
          return {
            error: `soilTest.${key} must be a valid non-negative number`,
          };
        }

        const number = Number(value);

        if (
          !Number.isFinite(number) ||
          number < 0 ||
          (key === 'ph' && number > 14)
        ) {
          return {
            error: `soilTest.${key} must be a valid non-negative number`,
          };
        }

        soilTest[key] = number;
      }
    }

    payload.soilTest = soilTest;
  }

  if (payload.soilReport !== undefined && payload.soilReport !== null) {
    const report = payload.soilReport;

    if (
      !report ||
      typeof report !== 'object' ||
      Array.isArray(report) ||
      !SOIL_REPORT_ID.test(String(report.id || '')) ||
      !SOIL_REPORT_TYPES.has(report.mimeType) ||
      typeof report.name !== 'string' ||
      !report.name.trim() ||
      report.name.length > 120 ||
      !Number.isInteger(report.size) ||
      report.size < 1 ||
      report.size > MAX_SOIL_REPORT_BYTES ||
      typeof report.uploadedAt !== 'string' ||
      report.uploadedAt.length > 40 ||
      (report.summary !== undefined &&
        (typeof report.summary !== 'string' ||
          report.summary.length > 1200)) ||
      (report.printedAdvice !== undefined &&
        (!Array.isArray(report.printedAdvice) ||
          report.printedAdvice.length > 5 ||
          report.printedAdvice.some(
            (advice) =>
              typeof advice !== 'string' || advice.length > 300,
          )))
    ) {
      return { error: 'soilReport must refer to a valid uploaded soil report' };
    }

    payload.soilReport = {
      id: report.id,
      name: report.name.trim(),
      mimeType: report.mimeType,
      size: report.size,
      uploadedAt: report.uploadedAt,
      ...(report.summary !== undefined && {
        summary: report.summary.trim(),
      }),
      ...(report.printedAdvice !== undefined && {
        printedAdvice: report.printedAdvice.map((advice) => advice.trim()),
      }),
    };
  }

  if (
    !partial &&
    (!payload.name?.trim() ||
      !payload.location?.trim() ||
      Number(payload.area) <= 0)
  ) {
    return { error: 'Farm name, location, and a positive area are required' };
  }

  if (payload.name) payload.name = payload.name.trim();
  if (payload.location) payload.location = payload.location.trim();
  if (payload.area !== undefined) payload.area = Number(payload.area);
  if (!partial) payload.isDraft = false;

  return { payload };
}

async function validateOwnedSoilReport(payload, userId) {
  if (payload.soilReport == null) return null;

  const stored = await readStoredSoilReport(userId, payload.soilReport.id);

  if (
    !stored ||
    stored.buffer.length !== payload.soilReport.size ||
    stored.mimeType !== payload.soilReport.mimeType
  ) {
    return 'Soil report upload not found or does not belong to this account. Upload it again.';
  }

  return null;
}

router.get('/drafts', async (req, res, next) => {
  try {
    res.json(await farms.list(req.user.id, true));
  } catch (error) {
    next(error);
  }
});

router.post('/soil-reports/parse', (req, res, next) => {
  soilReportUpload.single('report')(req, res, (error) => {
    if (!error) return next();

    const uploadError = soilReportUploadError(error);

    if (uploadError) {
      return res.status(uploadError.status).json({
        error: uploadError.message,
      });
    }

    next(error);
  });
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Choose a soil report image or PDF first.',
      });
    }

    const type = detectSoilReportType(req.file.buffer);

    if (!type) {
      return res.status(415).json({
        error: 'Upload a clear JPG, PNG, WebP image, or PDF soil report.',
      });
    }

    const extracted = await readSoilReport(req.file, type);
    const report = await saveSoilReport(req.user.id, req.file, type);

    res.status(201).json({ report, ...extracted });
  } catch (error) {
    next(error);
  }
});

router.delete('/soil-reports/:id', async (req, res, next) => {
  try {
    const [ownedFarms, drafts] = await Promise.all([
      farms.list(req.user.id),
      farms.list(req.user.id, true),
    ]);

    if (
      [...ownedFarms, ...drafts].some(
        (farm) => farm.soilReport?.id === req.params.id,
      )
    ) {
      return res.status(409).json({
        error: 'This report is attached to a saved farm profile or draft and cannot be removed here.',
      });
    }

    await deleteSoilReport(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/soil-report', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft || !farm.soilReport?.id) {
      return res.status(404).json({ error: 'Soil report not found.' });
    }

    const report = await readStoredSoilReport(
      req.user.id,
      farm.soilReport.id,
    );

    if (!report) {
      return res.status(404).json({
        error: 'The saved soil report file is no longer available.',
      });
    }

    res.set({
      'Content-Type': report.mimeType,
      'Content-Disposition':
        `inline; filename="soil-report.${farm.soilReport.id.split('.').pop()}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });

    res.send(report.buffer);
  } catch (error) {
    next(error);
  }
});

// Save a new draft. The authenticated ID is explicitly passed as userId.
router.post('/drafts', async (req, res, next) => {
  try {
    const { payload, error } = farmPayload(req.body, { partial: true });

    if (error) {
      return res.status(400).json({ error });
    }

    const userId = req.user.id;

    const reportError = await validateOwnedSoilReport(payload, userId);

    if (reportError) {
      return res.status(400).json({ error: reportError });
    }

    const draft = await farms.create({
      ...payload,
      name: payload.name?.trim() || 'Untitled farm',
      userId,
      isDraft: true,
    });

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
});

router.patch('/drafts/:id', async (req, res, next) => {
  try {
    const { payload, error } = farmPayload(req.body, { partial: true });

    if (error) {
      return res.status(400).json({ error });
    }

    const draft = await farms.get(req.user.id, req.params.id);

    if (!draft || !draft.isDraft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const reportError = await validateOwnedSoilReport(payload, req.user.id);

    if (reportError) {
      return res.status(400).json({ error: reportError });
    }

    const updated = await farms.update(req.user.id, req.params.id, {
      ...payload,
      isDraft: true,
    });

    if (
      draft.soilReport?.id &&
      draft.soilReport.id !== updated.soilReport?.id
    ) {
      await deleteSoilReport(req.user.id, draft.soilReport.id);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.post('/drafts/:id/complete', async (req, res, next) => {
  try {
    const draft = await farms.get(req.user.id, req.params.id);

    if (!draft || !draft.isDraft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const mergedProfile = {
      ...(draft.profile || {}),
      ...(req.body?.profile || {}),
      basic: {
        ...(draft.profile?.basic || {}),
        ...(req.body?.profile?.basic || {}),
      },
    };

    const { payload, error } = farmPayload({ profile: mergedProfile });

    if (error) {
      return res.status(400).json({ error });
    }

    const reportError = await validateOwnedSoilReport(payload, req.user.id);

    if (reportError) {
      return res.status(400).json({ error: reportError });
    }

    const updated = await farms.update(req.user.id, req.params.id, {
      ...payload,
      isDraft: false,
    });

    if (
      draft.soilReport?.id &&
      draft.soilReport.id !== updated.soilReport?.id
    ) {
      await deleteSoilReport(req.user.id, draft.soilReport.id);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    res.json(await farms.list(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json(farm);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { payload, error } = farmPayload(req.body);

    if (error) {
      return res.status(400).json({ error });
    }

    const userId = req.user.id;

    const reportError = await validateOwnedSoilReport(payload, userId);

    if (reportError) {
      return res.status(400).json({ error: reportError });
    }

    const farm = await farms.create({
      ...payload,
      userId,
    });

    res.status(201).json(farm);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({
      cropHistory: farm.cropHistory || [],
      activities: farm.activities || [],
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/history', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return res.status(400).json({
        error: 'Crop history entry must be an object',
      });
    }

    const crop = typeof req.body.crop === 'string'
      ? req.body.crop.trim()
      : '';

    if (!crop || crop.length > 100) {
      return res.status(400).json({
        error: 'crop is required and must be at most 100 characters',
      });
    }

    const record = {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      crop,
      season: String(req.body.season || '').slice(0, 40),
      year: Number.isInteger(Number(req.body.year))
        ? Number(req.body.year)
        : null,
      outcome: ['successful', 'partial', 'failed', 'unknown'].includes(
        req.body.outcome,
      ) ? req.body.outcome : 'unknown',
    };

    const cropHistory = [...(farm.cropHistory || []), record].slice(-50);
    const updated = await farms.update(req.user.id, req.params.id, {
      cropHistory,
    });

    res.status(201).json({ cropHistory: updated.cropHistory });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/history/:recordId', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const cropHistory = [...(farm.cropHistory || [])];
    const index = cropHistory.findIndex(
      (record) => record.id === req.params.recordId,
    );

    if (index < 0) {
      return res.status(404).json({
        error: 'Crop history record not found',
      });
    }

    const allowed = new Set([
      'crop', 'season', 'year', 'outcome', 'sowingDate', 'harvestDate',
      'yield', 'finances', 'issues', 'failureReason',
    ]);

    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body) ||
      Object.keys(req.body).some((key) => !allowed.has(key))
    ) {
      return res.status(400).json({
        error: 'Crop history update contains unsupported fields',
      });
    }

    cropHistory[index] = {
      ...cropHistory[index],
      ...req.body,
      id: cropHistory[index].id,
    };

    if (
      typeof cropHistory[index].crop !== 'string' ||
      !cropHistory[index].crop.trim()
    ) {
      return res.status(400).json({ error: 'crop is required' });
    }

    const updated = await farms.update(req.user.id, req.params.id, {
      cropHistory,
    });

    res.json({ cropHistory: updated.cropHistory });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/activities', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const { type, description, date } = req.body || {};

    if (
      typeof type !== 'string' ||
      !type.trim() ||
      typeof description !== 'string' ||
      !description.trim()
    ) {
      return res.status(400).json({
        error: 'Activity type and description are required',
      });
    }

    const activity = {
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type.trim().slice(0, 80),
      description: description.trim().slice(0, 1000),
      date: typeof date === 'string' ? date.slice(0, 30) : new Date().toISOString(),
    };

    const activities = [...(farm.activities || []), activity].slice(-100);
    const updated = await farms.update(req.user.id, req.params.id, {
      activities,
    });

    res.status(201).json({ activities: updated.activities });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/recommendations', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const profile = farm.profile || {};
    const basic = profile.basic || {};
    const soil = profile.soil || {};
    const water = profile.water || {};
    const planning = profile.preferences || {};

    const normalizedSoil = String(soil.soilType || farm.soilType || '')
      .toLowerCase()
      .replace('black cotton', 'black')
      .replace('red laterite', 'laterite')
      .replace('clayey', 'clay');

    const season = SEASONS.includes(req.body?.season)
      ? req.body.season
      : (planning.season && SEASONS.includes(planning.season)
        ? planning.season
        : currentSeason());

    const availability = String(water.availability || '').toLowerCase();

    const waterStatus = availability && availability !== 'unknown'
      ? availability
      : String(basic.irrigation || '').toLowerCase();

    const irrigation = [
      'reliable', 'available', 'irrigated', 'both',
    ].includes(waterStatus) ? 'irrigated' : 'rainfed';

    const missingInformation = [];

    if (![
      'black', 'red', 'alluvial', 'loamy', 'sandy', 'clay', 'laterite',
    ].includes(normalizedSoil)) {
      missingInformation.push('Soil type (or a soil test)');
    }

    if (!waterStatus || ['unknown', 'uncertain'].includes(waterStatus)) {
      missingInformation.push('Water availability');
    }

    if (missingInformation.length) {
      return res.status(422).json({
        error: 'Please add key farm information before requesting a crop shortlist.',
        missingInformation,
      });
    }

    const parsedPh = Number(soil.ph);

    const suitability = suggestCrops({
      soilType: normalizedSoil,
      ph: soil.phKnown === false ||
        soil.ph === '' ||
        soil.ph == null ||
        !Number.isFinite(parsedPh) ? 7 : parsedPh,
      season,
      irrigation,
    });

    if (suitability.error) {
      return res.status(400).json({ error: suitability.error });
    }

    let weather = null;
    let weatherStatus = {
      status: 'unavailable',
      reason: 'Add voluntary GPS coordinates to request a local forecast.',
    };

    const latitude = Number(basic.latitude);
    const longitude = Number(basic.longitude);

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      try {
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&forecast_days=1&timezone=auto`,
          { signal: AbortSignal.timeout(7000) },
        );

        if (!weatherResponse.ok) {
          throw new Error(`Weather source returned ${weatherResponse.status}`);
        }

        const weatherData = await weatherResponse.json();

        weather = {
          temperature: weatherData.current?.temperature_2m,
          humidity: weatherData.current?.relative_humidity_2m,
          rainfall: weatherData.daily?.precipitation_sum?.[0],
        };

        weatherStatus = {
          status: 'available',
          source: 'Open-Meteo forecast',
          retrievedAt: new Date().toISOString(),
        };
      } catch (error) {
        weatherStatus = {
          status: 'unavailable',
          reason: `Weather request failed: ${error.message}`,
        };
      }
    }

    let modelPrediction = null;

    const nutrients = {
      N: Number(soil.nitrogen),
      P: Number(soil.phosphorus),
      K: Number(soil.potassium),
    };

    const hasNutrients = [
      'nitrogen', 'phosphorus', 'potassium',
    ].every((key) =>
      soil[key] !== '' &&
      soil[key] != null &&
      Number.isFinite(Number(soil[key])) &&
      Number(soil[key]) >= 0
    );

    let cropModelStatus = {
      status: 'unavailable',
      reason: 'The crop model needs a soil-test NPK result and local weather values.',
    };

    if (
      hasNutrients &&
      weather &&
      [weather.temperature, weather.humidity, weather.rainfall].every(Number.isFinite)
    ) {
      try {
        const modelResponse = await fetch(`${ML_SERVICE_URL}/predict/crop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000),
          body: JSON.stringify({
            ...nutrients,
            ...weather,
            ph: soil.phKnown === 'unknown' ||
              soil.ph === '' ||
              soil.ph == null ? 7 : Number(soil.ph),
          }),
        });

        if (!modelResponse.ok) {
          throw new Error(`ML service returned ${modelResponse.status}`);
        }

        modelPrediction = await modelResponse.json();

        cropModelStatus = {
          status: 'available',
          source: 'Crop recommendation model',
          modelPrediction: modelPrediction.prediction,
        };
      } catch (error) {
        cropModelStatus = {
          status: 'unavailable',
          reason: `Crop model request failed: ${error.message}`,
        };
      }
    }

    const history = farm.cropHistory || profile.cropHistory || [];
    const previousCrop = history.length
      ? history[history.length - 1].crop
      : null;

    const prefer = Array.isArray(planning.preferredCrops)
      ? planning.preferredCrops : [];

    const avoid = Array.isArray(planning.avoidedCrops)
      ? planning.avoidedCrops : [];

    const lowWater = [
      'limited', 'uncertain', 'seasonal', 'low', 'rainfed', 'none',
    ].includes(waterStatus) || irrigation === 'rainfed';

    const modelRanks = new Map(
      (modelPrediction?.recommendations || []).map((item, index) => [
        String(item.crop).toLowerCase(),
        { rank: index, probability: Number(item.score) },
      ]),
    );

    const viable = suitability.recommendations
      .map((item) => {
        const cropInfo = CROPS.find((crop) => crop.name === item.crop);
        const seasonCompatible = cropInfo?.seasons.includes(season) || false;
        const waterCompatible = !(lowWater && cropInfo?.water === 'high');
        const reasons = [...item.reasons];

        if (item.crop === previousCrop) {
          reasons.push('Same as the most recent recorded crop; consider rotation.');
        }

        if (prefer.includes(item.crop)) {
          reasons.push('Matches your preferred crops.');
        }

        if (avoid.includes(item.crop)) {
          reasons.push('You marked this crop as one to avoid.');
        }

        if (!seasonCompatible) {
          reasons.push(`Not ranked: the existing crop guide does not list it for ${season}.`);
        }

        if (!waterCompatible) {
          reasons.push('Not ranked: high water demand conflicts with the recorded water availability.');
        }

        return {
          ...item,
          score: Math.min(
            100,
            item.score + (prefer.includes(item.crop) ? PREFERENCE_BONUS : 0),
          ),
          reasons,
          seasonCompatible,
          waterCompatible,
          estimatedCost: { status: 'not_available', amount: null },
          marketPrice: { status: 'not_available', amount: null },
          yieldRange: { status: 'not_available', amount: null },
          riskNotes: [
            'Weather-specific risk is unavailable unless farm coordinates are recorded.',
            'Local market price and verified regional cost/yield data are unavailable.',
          ],
          fertilizer: fertilizePlan({
            crop: item.crop,
            areaAcres: farm.areaUnit === 'hectares'
              ? Number(farm.area) * 2.47105
              : farm.areaUnit === 'acres'
                ? Number(farm.area)
                : 1,
            soilType: farm.soilType || normalizedSoil,
          }),
          modelPrediction: modelRanks.has(item.crop.toLowerCase())
            ? modelRanks.get(item.crop.toLowerCase()).probability
            : null,
          modelRank: modelRanks.get(item.crop.toLowerCase())?.rank ?? null,
          modelSource: modelRanks.has(item.crop.toLowerCase())
            ? 'Crop model prediction plus suitability constraints'
            : 'Existing crop suitability rules',
          scoreLabel: 'Explainable suitability score, not a probability.',
        };
      })
      .filter((item) =>
        item.seasonCompatible &&
        item.waterCompatible &&
        !avoid.includes(item.crop)
      )
      .sort((a, b) => {
        if (a.modelRank != null || b.modelRank != null) {
          return (
            (a.modelRank ?? Number.MAX_SAFE_INTEGER) -
            (b.modelRank ?? Number.MAX_SAFE_INTEGER)
          ) || b.score - a.score;
        }

        return b.score - a.score;
      })
      .slice(0, 5);

    const additionalMissingInformation = [];

    if (soil.phKnown !== false && (soil.ph == null || soil.ph === '')) {
      additionalMissingInformation.push('Soil pH');
    }

    if (!history.length) {
      additionalMissingInformation.push('Previous crops and outcomes');
    }

    if (soil.soilTestStatus !== 'tested') {
      additionalMissingInformation.push('Soil test results');
    }

    if (
      basic.latitude == null ||
      basic.latitude === '' ||
      basic.longitude == null ||
      basic.longitude === ''
    ) {
      additionalMissingInformation.push('GPS coordinates for local weather');
    }

    if (planning.budget == null || planning.budget === '') {
      additionalMissingInformation.push('Optional cultivation budget');
    }

    if (!viable.length) {
      return res.status(422).json({
        error: 'Not enough compatible farm information to produce a shortlist.',
        missingInformation: additionalMissingInformation,
      });
    }

    const recommendation = {
      id: `recommendation-${Date.now()}`,
      createdAt: new Date().toISOString(),
      season,
      source: 'Existing crop suitability rules; not a validated probability model.',
      scoringWeights: {
        ...CROP_SUITABILITY_WEIGHTS,
        preferredCropBonus: PREFERENCE_BONUS,
      },
      recommendations: viable,
      agents: {
        farmProfile: { status: 'available', source: 'Saved farm profile' },
        cropSuitability: { status: 'available', source: 'Existing crop suitability agent' },
        water: { status: 'available', source: 'Recorded irrigation and crop water class' },
        fertilizer: { status: 'partial', source: 'Existing fertilizer rule engine' },
        cropModel: cropModelStatus,
        weather: weatherStatus,
        market: {
          status: 'unavailable',
          reason: 'Available market route uses seeded historical inputs, not verified current market data.',
        },
        budget: {
          status: 'unavailable',
          reason: 'No validated regional cultivation-cost data is configured.',
        },
        disease: {
          status: 'unavailable',
          reason: 'Disease agent requires observed symptoms; no farm-history risk model is available.',
        },
        governmentBenefits: {
          status: 'unavailable',
          reason: 'No verified location-specific scheme eligibility source is configured.',
        },
      },
      missingInformation: additionalMissingInformation,
      assumptions: [
        'Suitability scores are explainable rule-engine scores, not probabilities.',
        'No yield, profit, or subsidy estimates are provided without verified supporting data.',
      ],
      selectedCrop: null,
    };

    const updated = await farms.update(req.user.id, farm.id, {
      recommendationHistory: [
        ...(farm.recommendationHistory || []),
        recommendation,
      ].slice(-20),
    });

    res.status(201).json({
      recommendation,
      recommendationHistory: updated.recommendationHistory,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/recommendations/:recommendationId/select', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const history = [...(farm.recommendationHistory || [])];
    const recommendation = history.find(
      (item) => item.id === req.params.recommendationId,
    );

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    const crop = recommendation.recommendations.find(
      (item) => item.crop === req.body?.crop,
    );

    if (!crop) {
      return res.status(400).json({
        error: 'Choose a crop from this recommendation',
      });
    }

    recommendation.selectedCrop = crop.crop;
    recommendation.selectedAt = new Date().toISOString();

    await farms.update(req.user.id, farm.id, {
      recommendationHistory: history,
    });

    res.json({
      farmId: farm.id,
      selectedCrop: crop.crop,
      recommendationId: recommendation.id,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const { payload, error } = farmPayload(req.body, { partial: true });

    if (error) {
      return res.status(400).json({ error });
    }

    const reportError = await validateOwnedSoilReport(payload, req.user.id);

    if (reportError) {
      return res.status(400).json({ error: reportError });
    }

    const updated = await farms.update(req.user.id, req.params.id, payload);

    if (!updated) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    if (
      farm.soilReport?.id &&
      farm.soilReport.id !== updated.soilReport?.id
    ) {
      await deleteSoilReport(req.user.id, farm.soilReport.id);
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const farm = await farms.get(req.user.id, req.params.id);

    if (!farm || farm.isDraft) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const result = await farms.remove(req.user.id, req.params.id);

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    if (farm.soilReport?.id) {
      await deleteSoilReport(req.user.id, farm.soilReport.id);
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
