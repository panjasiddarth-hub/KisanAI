// src/middleware/ownership.js — farm / plot ownership for routes that accept them in the body or query.
// Use after requireAuth. A farmId or plotId the caller doesn't own is a 404 (same as the farm routes),
// so another farmer's ids can't be probed. On success the loaded records are on req.farmContext.
import { farms, plots } from '../database/repositories/store.js';

export async function verifyFarmContext(req, res, next) {
  try {
    const src = { ...(req.query || {}), ...(req.body && typeof req.body === 'object' ? req.body : {}) };
    const farmId = src.farmId ? String(src.farmId) : null;
    const plotId = src.plotId ? String(src.plotId) : null;
    if (!farmId && !plotId) return next();
    if (plotId && !farmId) return res.status(400).json({ error: 'plotId requires farmId' });
    const farm = await farms.get(req.user.id, farmId);
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    let plot = null;
    if (plotId) {
      plot = await plots.get(req.user.id, farm.id, plotId);
      if (!plot) return res.status(404).json({ error: 'Plot not found' });
    }
    req.farmContext = { farm, plot };
    next();
  } catch (err) {
    next(err);
  }
}
