// One async persistence API over MongoDB or in-memory arrays.
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { CropPlan } from '../models/CropPlan.js';
import { Farm } from '../models/Farm.js';
import { Crop } from '../models/Crop.js';
import { Recommendation } from '../models/Recommendation.js';
import mongoose from 'mongoose';
import { Plot } from '../models/Plot.js';
import { CropCycle } from '../models/CropCycle.js';
import { FarmLock } from '../models/FarmLock.js';
import { Assessment } from '../models/Assessment.js';

const memory = { users: [], plans: [], farms: [], crops: [], recommendations: [], plots: [], cycles: [], assessments: [] };
const isMongo = () => globalThis.__DB_MODE__ === 'mongodb';

// Same id format in both modes (24-char hex, time-ordered). `String(Date.now())` collided when two
// records were created in the same millisecond.
export const newId = () => new mongoose.Types.ObjectId().toHexString();

// Expected conflicts that routes turn into 409s (duplicate plot name, second open crop cycle, …).
export class StoreConflict extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const isDupKey = (err, field) => err?.code === 11000 && Object.keys(err.keyPattern || err.keyValue || {}).includes(field);
// A malformed id can never match a document: treat it as "not found" instead of a 500.
const notFoundOnBadId = (err) => { if (err?.name === 'CastError' && err.path === '_id') return null; throw err; };

const publicUser = (u) => u && {
  id: String(u._id || u.id), name: u.name, email: u.email, role: u.role,
  phone: u.phone || '', location: u.location || '', avatar: null,
};

export const users = {
  async findByEmail(email) {
    if (isMongo()) return User.findOne({ email: email.toLowerCase() }).lean();
    return memory.users.find(u => u.email === email.toLowerCase()) || null;
  },
  async findById(id) {
    if (isMongo()) return User.findById(id).lean().catch(() => null);
    return memory.users.find(u => u.id === id) || null;
  },
  async create({ name, email, password }) {
    const passwordHash = await bcrypt.hash(password, 10);
    if (isMongo()) {
      const doc = await User.create({ name, email: email.toLowerCase(), passwordHash });
      return doc.toObject();
    }
    const user = { id: newId(), name, email: email.toLowerCase(), passwordHash, role: 'farmer', phone: '', location: '' };
    memory.users.push(user);
    return user;
  },
  async verifyPassword(user, password) {
    return bcrypt.compare(password, user.passwordHash);
  },
  public: publicUser,
};

export const plans = {
  async create(plan) {
    if (isMongo()) {
      const doc = await CropPlan.create(plan);
      return { ...doc.toObject(), id: String(doc._id) };
    }
    const saved = { ...plan, id: newId(), createdAt: new Date().toISOString() };
    memory.plans.push(saved);
    return saved;
  },
  async list(userId) {
    if (isMongo()) {
      const docs = await CropPlan.find({ userId }).sort({ createdAt: -1 }).lean();
      return docs.map(d => ({ ...d, id: String(d._id) }));
    }
    return memory.plans.filter(p => p.userId === userId).reverse();
  },
  async get(userId, id) {
    if (isMongo()) {
      const d = await CropPlan.findOne({ _id: id, userId }).lean().catch(() => null);
      return d && { ...d, id: String(d._id) };
    }
    return memory.plans.find(p => p.id === id && p.userId === userId) || null;
  },
  async remove(userId, id) {
    if (isMongo()) return CropPlan.deleteOne({ _id: id, userId });
    const i = memory.plans.findIndex(p => p.id === id && p.userId === userId);
    if (i >= 0) memory.plans.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  },
  async findForFarm(userId, farmId, crop, sowingDate) {
    if (isMongo()) {
      const d = await CropPlan.findOne({ userId, farmId, crop, sowingDate, plotId: null }).lean();
      return d && { ...d, id: String(d._id) };
    }
    return memory.plans.find(p => p.userId === userId && p.farmId === farmId && !p.plotId && p.crop === crop && p.sowingDate === sowingDate) || null;
  },
  async setEventDone(userId, planId, eventIndex, done) {
    const plan = await this.get(userId, planId);
    if (!plan || !plan.events[eventIndex]) return null;
    plan.events[eventIndex].done = !!done;
    if (isMongo()) {
      await CropPlan.updateOne(
        { _id: planId, userId },
        { $set: { [`events.${eventIndex}.done`]: !!done } }
      );
    }
    return plan;
  },
};

export const farms = {
  async create(farm) {
    if (isMongo()) {
      const doc = await Farm.create(farm);
      return { ...doc.toObject(), id: String(doc._id) };
    }
    const saved = { ...farm, id: newId(), createdAt: new Date().toISOString() };
    memory.farms.push(saved);
    return saved;
  },
  async list(userId) {
    if (isMongo()) {
      const docs = await Farm.find({ userId }).sort({ createdAt: -1 }).lean();
      return docs.map(d => ({ ...d, id: String(d._id) }));
    }
    return memory.farms.filter(f => f.userId === userId).reverse();
  },
  async get(userId, id, { session } = {}) {
    if (isMongo()) {
      const d = await Farm.findOne({ _id: id, userId }).session(session || null).lean().catch(() => null);
      return d && { ...d, id: String(d._id) };
    }
    return memory.farms.find(f => f.id === id && f.userId === userId) || null;
  },
  async update(userId, id, updates, { session } = {}) {
    if (isMongo()) {
      // null clears a field ($unset); everything else is $set. Validators enforce schema ranges.
      const $set = {}, $unset = {};
      for (const [k, v] of Object.entries(updates)) { if (v === null) $unset[k] = ''; else $set[k] = v; }
      const ops = { ...(Object.keys($set).length && { $set }), ...(Object.keys($unset).length && { $unset }) };
      const doc = await Farm.findOneAndUpdate({ _id: id, userId }, ops, { new: true, runValidators: true, session }).lean().catch(notFoundOnBadId);
      return doc && { ...doc, id: String(doc._id) };
    }
    const idx = memory.farms.findIndex(f => f.id === id && f.userId === userId);
    if (idx >= 0) {
      memory.farms[idx] = { ...memory.farms[idx], ...updates, updatedAt: new Date().toISOString() };
      return memory.farms[idx];
    }
    return null;
  },
  async remove(userId, id) {
    // A farm's recommendation history, plots and crop cycles are meaningless without the farm —
    // delete them with the farm (calendar plans are kept, as before).
    if (isMongo()) {
      const result = await Farm.deleteOne({ _id: id, userId }).catch(notFoundOnBadId);
      if (result?.deletedCount) {
        await Recommendation.deleteMany({ userId, farmId: String(id) });
        await Plot.deleteMany({ userId, farmId: String(id) });
        await CropCycle.deleteMany({ userId, farmId: String(id) });
        await Assessment.deleteMany({ userId, farmId: String(id) });
      }
      return result || { deletedCount: 0 };
    }
    const i = memory.farms.findIndex(f => f.id === id && f.userId === userId);
    if (i >= 0) {
      memory.farms.splice(i, 1);
      const other = (r) => !(r.userId === userId && r.farmId === id);
      memory.recommendations = memory.recommendations.filter(other);
      memory.plots = memory.plots.filter(other);
      memory.cycles = memory.cycles.filter(other);
      memory.assessments = memory.assessments.filter(other);
    }
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
};

export const crops = {
  async create(crop) {
    if (isMongo()) {
      const doc = await Crop.create(crop);
      return { ...doc.toObject(), id: String(doc._id) };
    }
    const saved = { ...crop, id: newId(), createdAt: new Date().toISOString() };
    memory.crops.push(saved);
    return saved;
  },
  async list(userId) {
    if (isMongo()) {
      const docs = await Crop.find({ userId }).sort({ createdAt: -1 }).lean();
      return docs.map(d => ({ ...d, id: String(d._id) }));
    }
    return memory.crops.filter(c => c.userId === userId).reverse();
  },
  async get(userId, id) {
    if (isMongo()) {
      const d = await Crop.findOne({ _id: id, userId }).lean().catch(() => null);
      return d && { ...d, id: String(d._id) };
    }
    return memory.crops.find(c => c.id === id && c.userId === userId) || null;
  },
  async update(userId, id, updates) {
    if (isMongo()) {
      const doc = await Crop.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true, runValidators: true }).lean().catch(notFoundOnBadId);
      return doc && { ...doc, id: String(doc._id) };
    }
    const idx = memory.crops.findIndex(c => c.id === id && c.userId === userId);
    if (idx >= 0) {
      memory.crops[idx] = { ...memory.crops[idx], ...updates, updatedAt: new Date().toISOString() };
      return memory.crops[idx];
    }
    return null;
  },
  async remove(userId, id) {
    if (isMongo()) return (await Crop.deleteOne({ _id: id, userId }).catch(notFoundOnBadId)) || { deletedCount: 0 };
    const i = memory.crops.findIndex(c => c.id === id && c.userId === userId);
    if (i >= 0) memory.crops.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
};

export const recommendations = {
  async create(rec) {
    if (isMongo()) {
      const doc = await Recommendation.create(rec);
      return { ...doc.toObject(), id: String(doc._id) };
    }
    const saved = {
      ...rec, id: newId(),
      selectedCrop: null, selectedAt: null, createdAt: new Date().toISOString(),
    };
    memory.recommendations.push(saved);
    return saved;
  },
  async listForFarm(userId, farmId, limit = 20) {
    if (isMongo()) {
      // Farm-level runs only: plot recommendations (Milestone 4) carry a plotId and stay with their plot.
      const docs = await Recommendation.find({ userId, farmId, plotId: null }).sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map(d => ({ ...d, id: String(d._id) }));
    }
    return memory.recommendations.filter(r => r.userId === userId && r.farmId === farmId && !r.plotId).reverse().slice(0, limit);
  },
  async get(userId, farmId, id) {
    if (isMongo()) {
      const d = await Recommendation.findOne({ _id: id, userId, farmId, plotId: null }).lean().catch(notFoundOnBadId);
      return d && { ...d, id: String(d._id) };
    }
    return memory.recommendations.find(r => r.id === id && r.userId === userId && r.farmId === farmId && !r.plotId) || null;
  },
  async markSelected(userId, farmId, id, crop) {
    const selectedAt = new Date();
    if (isMongo()) {
      const d = await Recommendation.findOneAndUpdate(
        { _id: id, userId, farmId }, { $set: { selectedCrop: crop, selectedAt } }, { new: true }
      ).lean().catch(notFoundOnBadId);
      return d && { ...d, id: String(d._id) };
    }
    const r = memory.recommendations.find(x => x.id === id && x.userId === userId && x.farmId === farmId);
    if (!r) return null;
    Object.assign(r, { selectedCrop: crop, selectedAt: selectedAt.toISOString() });
    return r;
  },
};

// ---------------------------------------------------------------------------------------------
// Plots and crop cycles. Every lookup is scoped by owner AND parent ids (farm for plots; plot for
// cycles), so a record can't be reached — or written — through another farm or plot.
// In-memory writes check and insert without awaiting in between, so they are atomic like the
// MongoDB unique indexes they mirror.
// ---------------------------------------------------------------------------------------------
const withId = (d) => d && { ...d, id: String(d._id || d.id) };
const clone = (o) => (o ? structuredClone(o) : null);
let indexesReady = null;
const ensureIndexes = () => (indexesReady ||= Promise.all([Plot.init(), CropCycle.init(), FarmLock.init(), Assessment.init(), CropPlan.init()]));

function memUpdate(list, match, { set = {}, unset = [], inc = {} }) {
  const i = list.findIndex(match);
  if (i < 0) return null;
  const next = { ...list[i], ...structuredClone(set), updatedAt: new Date().toISOString() };
  for (const k of unset) delete next[k];
  for (const [k, v] of Object.entries(inc)) next[k] = (next[k] || 0) + v;
  return { i, next };
}
const mongoOps = ({ set = {}, unset = [], inc = {} }) => ({
  ...(Object.keys(set).length && { $set: set }),
  ...(unset.length && { $unset: Object.fromEntries(unset.map((k) => [k, ''])) }),
  ...(Object.keys(inc).length && { $inc: inc }),
});

// ---------------------------------------------------------------------------------------------
// Farm lock: serialises writes that can increase a farm's allocated area.
// - In-process: a promise chain per farm (covers the in-memory store and cuts conflicts in MongoDB).
// - MongoDB: one transaction that first increments the farm's FarmLock document; concurrent
//   transactions on the same farm write-conflict and withTransaction retries them, so the second
//   one re-reads the plots after the first committed. Business rejections are returned, not thrown.
// ---------------------------------------------------------------------------------------------
const localLocks = new Map();
async function localMutex(key, fn) {
  const prev = localLocks.get(key) || Promise.resolve();
  let release;
  const mine = new Promise((r) => { release = r; });
  const tail = prev.then(() => mine);
  localLocks.set(key, tail);
  await prev;
  try { return await fn(); } finally {
    release();
    if (localLocks.get(key) === tail) localLocks.delete(key);
  }
}
let warnedNoTransactions = false;
export async function withFarmLock(userId, farmId, fn) {
  const key = String(farmId);
  return localMutex(key, async () => {
    if (!isMongo()) return fn(null);
    await ensureIndexes();
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        await FarmLock.updateOne({ _id: key }, { $inc: { v: 1 }, $set: { userId, at: new Date() } }, { upsert: true, session });
        result = await fn(session);
      });
      return result;
    } catch (err) {
      // Standalone MongoDB (no replica set) has no transactions: fall back to the in-process lock.
      if (err?.code === 20 || /Transaction numbers are only allowed/i.test(err?.message || '')) {
        if (!warnedNoTransactions) {
          console.warn('⚠️  MongoDB transactions unavailable (not a replica set): farm area checks are serialised only within this process.');
          warnedNoTransactions = true;
        }
        return fn(null);
      }
      throw err;
    } finally {
      await session.endSession();
    }
  });
}

export const plots = {
  async listForFarm(userId, farmId, { status = 'active', session } = {}) {
    const f = { userId, farmId: String(farmId), ...(status !== 'all' && { status }) };
    if (isMongo()) return (await Plot.find(f).sort({ _id: 1 }).session(session || null).lean()).map(withId);
    return memory.plots.filter((p) => p.userId === userId && p.farmId === f.farmId && (status === 'all' || p.status === status)).map(clone);
  },
  async listActiveForUser(userId) {
    if (isMongo()) return (await Plot.find({ userId, status: 'active' }, { farmId: 1, areaAcres: 1, areaUnit: 1 }).lean()).map(withId);
    return memory.plots.filter((p) => p.userId === userId && p.status === 'active').map(clone);
  },
  async countForFarm(userId, farmId, { session } = {}) {
    if (isMongo()) return Plot.countDocuments({ userId, farmId: String(farmId) }).session(session || null);
    return memory.plots.filter((p) => p.userId === userId && p.farmId === String(farmId)).length;
  },
  async get(userId, farmId, id) {
    if (isMongo()) return withId(await Plot.findOne({ _id: id, userId, farmId: String(farmId) }).lean().catch(notFoundOnBadId));
    return clone(memory.plots.find((p) => p.id === id && p.userId === userId && p.farmId === String(farmId)));
  },
  async create(doc, { session } = {}) {
    if (isMongo()) {
      await ensureIndexes();
      try {
        const created = session ? (await Plot.create([doc], { session }))[0] : await Plot.create(doc);
        return withId(created.toObject());
      } catch (err) {
        if (isDupKey(err, 'nameKey')) throw new StoreConflict('DUPLICATE_NAME', 'A plot with this name already exists on this farm');
        throw err;
      }
    }
    if (doc.status === 'active' && memory.plots.some((p) => p.farmId === doc.farmId && p.status === 'active' && p.nameKey === doc.nameKey)) {
      throw new StoreConflict('DUPLICATE_NAME', 'A plot with this name already exists on this farm');
    }
    const now = new Date().toISOString();
    const saved = { ...structuredClone(doc), id: newId(), createdAt: now, updatedAt: now };
    memory.plots.push(saved);
    return clone(saved);
  },
  async update(userId, farmId, id, ops, { session } = {}) {
    if (isMongo()) {
      await ensureIndexes();
      try {
        const d = await Plot.findOneAndUpdate({ _id: id, userId, farmId: String(farmId) }, mongoOps(ops), { new: true, runValidators: true, session })
          .lean().catch(notFoundOnBadId);
        return withId(d);
      } catch (err) {
        if (isDupKey(err, 'nameKey')) throw new StoreConflict('DUPLICATE_NAME', 'A plot with this name already exists on this farm');
        throw err;
      }
    }
    const u = memUpdate(memory.plots, (p) => p.id === id && p.userId === userId && p.farmId === String(farmId), ops);
    if (!u) return null;
    if (u.next.status === 'active' && memory.plots.some((p, j) => j !== u.i && p.farmId === u.next.farmId && p.status === 'active' && p.nameKey === u.next.nameKey)) {
      throw new StoreConflict('DUPLICATE_NAME', 'A plot with this name already exists on this farm');
    }
    memory.plots[u.i] = u.next;
    return clone(u.next);
  },
  async remove(userId, farmId, id) {
    if (isMongo()) return (await Plot.deleteOne({ _id: id, userId, farmId: String(farmId) }).catch(notFoundOnBadId)) || { deletedCount: 0 };
    const i = memory.plots.findIndex((p) => p.id === id && p.userId === userId && p.farmId === String(farmId));
    if (i >= 0) memory.plots.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  },
};

export const cropCycles = {
  // Newest first, without observations; cursor = id of the last item of the previous page.
  async listForPlot(userId, plotId, { limit = 20, cursor = null } = {}) {
    let items;
    if (isMongo()) {
      const f = { userId, plotId: String(plotId) };
      if (cursor) f._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      items = (await CropCycle.find(f, { observations: 0 }).sort({ _id: -1 }).limit(limit + 1).lean()).map(withId);
    } else {
      items = memory.cycles
        .filter((c) => c.userId === userId && c.plotId === String(plotId) && (!cursor || c.id < cursor))
        .sort((a, b) => (a.id < b.id ? 1 : -1))
        .slice(0, limit + 1)
        .map(({ observations, ...rest }) => clone(rest));
    }
    const more = items.length > limit;
    const page = items.slice(0, limit);
    return { items: page, nextCursor: more ? page[page.length - 1].id : null };
  },
  async countForPlot(userId, plotId) {
    if (isMongo()) return CropCycle.countDocuments({ userId, plotId: String(plotId) });
    return memory.cycles.filter((c) => c.userId === userId && c.plotId === String(plotId)).length;
  },
  async findOpen(userId, plotId) {
    if (isMongo()) return withId(await CropCycle.findOne({ userId, plotId: String(plotId), isOpen: true }, { observations: 0 }).lean());
    const c = memory.cycles.find((x) => x.userId === userId && x.plotId === String(plotId) && x.isOpen);
    return c ? clone({ ...c, observations: undefined }) : null;
  },
  async listOpenForUser(userId) {
    if (isMongo()) return (await CropCycle.find({ userId, isOpen: true }, { farmId: 1, plotId: 1, crop: 1, status: 1 }).lean()).map(withId);
    return memory.cycles.filter((c) => c.userId === userId && c.isOpen).map((c) => ({ id: c.id, farmId: c.farmId, plotId: c.plotId, crop: c.crop, status: c.status }));
  },
  async get(userId, plotId, id) {
    if (isMongo()) return withId(await CropCycle.findOne({ _id: id, userId, plotId: String(plotId) }).lean().catch(notFoundOnBadId));
    return clone(memory.cycles.find((c) => c.id === id && c.userId === userId && c.plotId === String(plotId)));
  },
  async create(doc) {
    const conflict = () => new StoreConflict('OPEN_CYCLE_EXISTS', 'This plot already has an open crop cycle. Harvest or abandon it before starting another.');
    if (isMongo()) {
      await ensureIndexes();
      try { return withId((await CropCycle.create(doc)).toObject()); } catch (err) {
        if (isDupKey(err, 'plotId')) throw conflict();
        throw err;
      }
    }
    if (doc.isOpen && memory.cycles.some((c) => c.plotId === doc.plotId && c.isOpen)) throw conflict();
    const now = new Date().toISOString();
    const saved = { ...structuredClone(doc), id: newId(), createdAt: now, updatedAt: now };
    memory.cycles.push(saved);
    return clone(saved);
  },
  async update(userId, plotId, id, ops) {
    if (isMongo()) {
      const d = await CropCycle.findOneAndUpdate({ _id: id, userId, plotId: String(plotId) }, mongoOps(ops), { new: true, runValidators: true })
        .lean().catch(notFoundOnBadId);
      return withId(d);
    }
    const u = memUpdate(memory.cycles, (c) => c.id === id && c.userId === userId && c.plotId === String(plotId), ops);
    if (!u) return null;
    memory.cycles[u.i] = u.next;
    return clone(u.next);
  },
  // Appends unless the cycle already holds `cap` observations (checked atomically in MongoDB).
  // Returns the updated cycle, 'FULL', or null when the cycle doesn't exist.
  async addObservation(userId, plotId, id, obs, cap) {
    if (isMongo()) {
      const d = await CropCycle.findOneAndUpdate(
        { _id: id, userId, plotId: String(plotId), [`observations.${cap - 1}`]: { $exists: false } },
        { $push: { observations: obs } }, { new: true, runValidators: true }
      ).lean().catch(notFoundOnBadId);
      if (d) return withId(d);
      return (await this.get(userId, plotId, id)) ? 'FULL' : null;
    }
    const c = memory.cycles.find((x) => x.id === id && x.userId === userId && x.plotId === String(plotId));
    if (!c) return null;
    if (c.observations.length >= cap) return 'FULL';
    c.observations.push(structuredClone(obs));
    c.updatedAt = new Date().toISOString();
    return clone(c);
  },
  async removeObservation(userId, plotId, id, obsId) {
    if (isMongo()) {
      // Match on the observation itself: with timestamps every update modifies `updatedAt`, so
      // modifiedCount is 1 even when $pull removed nothing.
      const r = await CropCycle.updateOne(
        { _id: id, userId, plotId: String(plotId), 'observations.id': obsId }, { $pull: { observations: { id: obsId } } }
      ).catch(notFoundOnBadId);
      return r?.matchedCount || 0;
    }
    const c = memory.cycles.find((x) => x.id === id && x.userId === userId && x.plotId === String(plotId));
    if (!c) return 0;
    const before = c.observations.length;
    c.observations = c.observations.filter((o) => o.id !== obsId);
    return before - c.observations.length;
  },
};

// ---------------------------------------------------------------------------------------------
// Plot-level calendars, recommendations and assessments (Milestone 4). Separate from the farm-level
// repositories so the Milestone 1–2 code paths are unchanged. Always scoped by owner + plot/cycle.
// ---------------------------------------------------------------------------------------------
export const plotPlans = {
  async findForCycle(userId, cropCycleId) {
    if (isMongo()) return withId(await CropPlan.findOne({ userId, cropCycleId: String(cropCycleId) }).lean());
    return clone(memory.plans.find((p) => p.userId === userId && p.cropCycleId === String(cropCycleId)));
  },
  // Idempotent: one calendar per crop cycle, also under concurrent requests (unique index /
  // atomic in-memory check). Returns { plan, created }.
  async createForCycle(plan) {
    if (isMongo()) {
      await ensureIndexes();
      try {
        return { plan: withId((await CropPlan.create(plan)).toObject()), created: true };
      } catch (err) {
        if (err?.code === 11000) {
          const existing = await this.findForCycle(plan.userId, plan.cropCycleId);
          if (existing) return { plan: existing, created: false };
          throw new StoreConflict('CALENDAR_CONFLICT', 'A calendar with the same farm, plot, crop and sowing date already exists.');
        }
        throw err;
      }
    }
    const existing = memory.plans.find((p) => p.userId === plan.userId && p.cropCycleId === plan.cropCycleId);
    if (existing) return { plan: clone(existing), created: false };
    const saved = { ...structuredClone(plan), id: newId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memory.plans.push(saved);
    return { plan: clone(saved), created: true };
  },
  async replaceTimeline(userId, cropCycleId, set) {
    if (isMongo()) {
      return withId(await CropPlan.findOneAndUpdate({ userId, cropCycleId: String(cropCycleId) }, { $set: set }, { new: true, runValidators: true }).lean());
    }
    const u = memUpdate(memory.plans, (p) => p.userId === userId && p.cropCycleId === String(cropCycleId), { set });
    if (!u) return null;
    memory.plans[u.i] = u.next;
    return clone(u.next);
  },
  // Tick an event by its stable id (never by position).
  async setEventDone(userId, cropCycleId, eventId, done) {
    if (isMongo()) {
      const d = await CropPlan.findOneAndUpdate(
        { userId, cropCycleId: String(cropCycleId), 'events.id': String(eventId) },
        { $set: { 'events.$.done': !!done } }, { new: true }
      ).lean();
      return withId(d);
    }
    const p = memory.plans.find((x) => x.userId === userId && x.cropCycleId === String(cropCycleId));
    const ev = p?.events.find((e) => e.id === String(eventId));
    if (!ev) return null;
    ev.done = !!done;
    p.updatedAt = new Date().toISOString();
    return clone(p);
  },
};

export const plotRecommendations = {
  async listForPlot(userId, plotId, { limit = 20, cursor = null } = {}) {
    let items;
    if (isMongo()) {
      const f = { userId, plotId: String(plotId) };
      if (cursor) f._id = { $lt: new mongoose.Types.ObjectId(cursor) };
      items = (await Recommendation.find(f).sort({ _id: -1 }).limit(limit + 1).lean()).map(withId);
    } else {
      items = memory.recommendations.filter((r) => r.userId === userId && r.plotId === String(plotId) && (!cursor || r.id < cursor))
        .sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, limit + 1).map(clone);
    }
    const more = items.length > limit;
    const page = items.slice(0, limit);
    return { items: page, nextCursor: more ? page[page.length - 1].id : null };
  },
  async get(userId, plotId, id) {
    if (isMongo()) return withId(await Recommendation.findOne({ _id: id, userId, plotId: String(plotId) }).lean().catch(notFoundOnBadId));
    return clone(memory.recommendations.find((r) => r.id === id && r.userId === userId && r.plotId === String(plotId)));
  },
  async markSelected(userId, plotId, id, crop, cropCycleId) {
    const set = { selectedCrop: crop, selectedAt: new Date(), cropCycleId: String(cropCycleId) };
    if (isMongo()) return withId(await Recommendation.findOneAndUpdate({ _id: id, userId, plotId: String(plotId) }, { $set: set }, { new: true }).lean().catch(notFoundOnBadId));
    const r = memory.recommendations.find((x) => x.id === id && x.userId === userId && x.plotId === String(plotId));
    if (!r) return null;
    Object.assign(r, { ...set, selectedAt: set.selectedAt.toISOString() });
    return clone(r);
  },
};

export const assessments = {
  async create(doc) {
    if (isMongo()) return withId((await Assessment.create(doc)).toObject());
    const saved = { ...structuredClone(doc), id: newId(), createdAt: new Date().toISOString() };
    memory.assessments.push(saved);
    return clone(saved);
  },
  async latest(userId, plotId, agent) {
    if (isMongo()) return withId(await Assessment.findOne({ userId, plotId: String(plotId), agent }).sort({ _id: -1 }).lean());
    const list = memory.assessments.filter((a) => a.userId === userId && a.plotId === String(plotId) && a.agent === agent);
    return clone(list[list.length - 1] || null);
  },
  async countForPlot(userId, plotId, agent) {
    if (isMongo()) return Assessment.countDocuments({ userId, plotId: String(plotId), agent });
    return memory.assessments.filter((a) => a.userId === userId && a.plotId === String(plotId) && a.agent === agent).length;
  },
};

// Demo farmer so the seeded login always works
export async function seedDemoUser() {
  const email = 'siddarth@kisan.com';
  if (!(await users.findByEmail(email))) {
    const user = await users.create({ name: 'Siddarth R.', email, password: 'password123' });
    console.log('👤 Seeded demo farmer: siddarth@kisan.com / password123');

    // Create demo farm and crop
    const f1 = await farms.create({
      userId: user.id || String(user._id),
      name: 'Shri Ram Farm',
      location: 'Nashik, Maharashtra',
      area: 5.2,
      areaUnit: 'acres',
      soilType: 'Black Cotton',
      waterSource: 'Borewell',
      crops: ['Wheat'],
      healthScore: 84
    });

    await crops.create({
      userId: user.id || String(user._id),
      farmId: f1.id,
      name: 'Wheat',
      variety: 'HD-2967',
      sowingDate: '2026-11-15',
      expectedHarvest: '2027-03-20',
      stage: 'Tillering',
      progress: 45,
      area: 2.5,
      notes: 'Showing healthy tillering. Apply urea in 2 weeks.'
    });
  }
}
