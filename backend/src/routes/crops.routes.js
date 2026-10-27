// src/routes/crops.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { crops, farms } from '../database/repositories/store.js';
import { pickAllowedFields } from '../utils/requestFields.js';
import { validateCropPayload } from '../utils/cropValidation.js';

const router = Router();
router.use(requireAuth);

const EDITABLE_CROP_FIELDS = [
  'name', 'variety', 'sowingDate', 'expectedHarvest', 'stage', 'progress',
  'area', 'yield', 'notes',
];
const CREATABLE_CROP_FIELDS = ['farmId', ...EDITABLE_CROP_FIELDS];

router.get('/', async (req, res, next) => {
  try {
    const list = await crops.list(req.user.id);
    res.json(list);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const input = pickAllowedFields(req.body, CREATABLE_CROP_FIELDS);
    if (typeof input.farmId !== 'string' || !input.farmId.trim()) {
      return res.status(400).json({ error: 'farmId is required' });
    }
    const validation = validateCropPayload(input);
    if (validation.errors.length) {
      return res.status(400).json({ error: 'Invalid crop details', details: validation.errors });
    }
    const farm = await farms.get(req.user.id, input.farmId.trim());
    if (!farm) return res.status(404).json({ error: 'Farm not found' });

    const crop = await crops.create({ ...validation.data, farmId: farm.id, userId: req.user.id });
    res.status(201).json(crop);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updates = pickAllowedFields(req.body, EDITABLE_CROP_FIELDS);
    if (!Object.keys(updates).length) {
      return res.status(400).json({ error: 'No editable crop fields supplied' });
    }
    const validation = validateCropPayload(updates, { partial: true });
    if (validation.errors.length) {
      return res.status(400).json({ error: 'Invalid crop details', details: validation.errors });
    }
    const updated = await crops.update(req.user.id, req.params.id, validation.data);
    if (!updated) return res.status(404).json({ error: 'Crop not found' });
    res.json(updated);
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await crops.remove(req.user.id, req.params.id);
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Crop not found' });
    res.json({ success: true });
  } catch (e) { next(e); }
});

export default router;
