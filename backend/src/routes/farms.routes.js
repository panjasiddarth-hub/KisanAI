// src/routes/farms.routes.js
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { farms } from '../repositories/store.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const list = await farms.list(req.user.id);
    res.json(list);
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const farm = await farms.create({ ...req.body, userId: req.user.id });
    res.status(201).json(farm);
  } catch (e) { next(e); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const updated = await farms.update(req.user.id, req.params.id, req.body);
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
