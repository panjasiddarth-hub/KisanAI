// src/repositories/store.js — one async API over MongoDB or in-memory arrays
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { CropPlan } from '../models/CropPlan.js';
import { Farm } from '../models/Farm.js';
import { Crop } from '../models/Crop.js';

const memory = { users: [], plans: [], farms: [], crops: [] };
const isMongo = () => globalThis.__DB_MODE__ === 'mongodb';

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
    const user = { id: String(Date.now()), name, email: email.toLowerCase(), passwordHash, role: 'farmer', phone: '', location: '' };
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
    const saved = { ...plan, id: String(Date.now()), createdAt: new Date().toISOString() };
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
    const saved = { ...farm, id: String(Date.now()), createdAt: new Date().toISOString() };
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
  async get(userId, id) {
    if (isMongo()) {
      const d = await Farm.findOne({ _id: id, userId }).lean().catch(() => null);
      return d && { ...d, id: String(d._id) };
    }
    return memory.farms.find(f => f.id === id && f.userId === userId) || null;
  },
  async update(userId, id, updates) {
    if (isMongo()) {
      const doc = await Farm.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
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
    if (isMongo()) return Farm.deleteOne({ _id: id, userId });
    const i = memory.farms.findIndex(f => f.id === id && f.userId === userId);
    if (i >= 0) memory.farms.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
};

export const crops = {
  async create(crop) {
    if (isMongo()) {
      const doc = await Crop.create(crop);
      return { ...doc.toObject(), id: String(doc._id) };
    }
    const saved = { ...crop, id: String(Date.now()), createdAt: new Date().toISOString() };
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
      const doc = await Crop.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true }).lean();
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
    if (isMongo()) return Crop.deleteOne({ _id: id, userId });
    const i = memory.crops.findIndex(c => c.id === id && c.userId === userId);
    if (i >= 0) memory.crops.splice(i, 1);
    return { deletedCount: i >= 0 ? 1 : 0 };
  }
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
