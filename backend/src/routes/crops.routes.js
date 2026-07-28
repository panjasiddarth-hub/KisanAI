// src/routes/crops.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { crops } from '../repositories/store.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const list = await crops.list(req.user.id);
    res.json(list);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const crop = await crops.create({ ...req.body, userId: req.user.id });
    res.status(201).json(crop);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updated = await crops.update(req.user.id, req.params.id, req.body);
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
