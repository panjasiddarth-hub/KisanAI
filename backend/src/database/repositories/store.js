// One async persistence API over MongoDB or in-memory arrays.
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { CropPlan } from '../models/CropPlan.js';
import { Farm } from '../models/Farm.js';
import { Crop } from '../models/Crop.js';
import { PendingSignup } from '../models/PendingSignup.js';
import { PendingPasswordReset } from '../models/PendingPasswordReset.js';

const memory = { users: [], plans: [], farms: [], crops: [], pendingSignups: [], pendingPasswordResets: [] };
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
  async findByPhone(phone) {
    if (isMongo()) return User.findOne({ phone }).lean();
    return memory.users.find(u => u.phone === phone) || null;
  },
  async findByIdentifier(identifier) {
    if (isMongo()) return User.findOne({ $or: [{ email: identifier }, { phone: identifier }] }).lean();
    return memory.users.find(u => u.email === identifier || u.phone === identifier) || null;
  },
  async findById(id) {
    if (isMongo()) return User.findById(id).lean().catch(() => null);
    return memory.users.find(u => u.id === id) || null;
  },
  async create({ name, email, phone, password }) {
    const passwordHash = await bcrypt.hash(password, 10);
    if (isMongo()) {
      const doc = await User.create({ name, ...(email ? { email: email.toLowerCase() } : {}), ...(phone ? { phone } : {}), passwordHash });
      return doc.toObject();
    }
    const user = { id: String(Date.now()), name, ...(email ? { email: email.toLowerCase() } : {}), ...(phone ? { phone } : {}), passwordHash, tokenVersion: 0, role: 'farmer', location: '' };
    memory.users.push(user);
    return user;
  },
  async createPendingSignup(record) {
    if (isMongo()) {
      const data = { ...record, contactKey: `${record.contactType}:${record.contact}` };
      return PendingSignup.findOneAndUpdate({ contactKey: data.contactKey }, data, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
    }
    const contactKey = `${record.contactType}:${record.contact}`;
    const pending = { ...record, contactKey, attempts: 0, createdAt: Date.now() };
    const index = memory.pendingSignups.findIndex(row => row.contactKey === contactKey);
    if (index < 0) memory.pendingSignups.push(pending); else memory.pendingSignups[index] = pending;
    return pending;
  },
  async findPendingSignup(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingSignup.findOne({ contactKey }).lean();
    const row = memory.pendingSignups.find(item => item.contactKey === contactKey) || null;
    return row && Date.now() - row.createdAt < 10 * 60 * 1000 ? row : null;
  },
  async incrementPendingSignupAttempts(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingSignup.findOneAndUpdate({ contactKey }, { $inc: { attempts: 1 } }, { new: true }).lean();
    const row = memory.pendingSignups.find(item => item.contactKey === contactKey);
    if (row) row.attempts += 1;
    return row || null;
  },
  async deletePendingSignup(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingSignup.deleteOne({ contactKey });
    const index = memory.pendingSignups.findIndex(row => row.contactKey === contactKey);
    if (index >= 0) memory.pendingSignups.splice(index, 1);
    return { deletedCount: index >= 0 ? 1 : 0 };
  },
  async consumePendingSignup(contactType, contact, otpHash) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingSignup.findOneAndDelete({ contactKey, otpHash, attempts: { $lt: 5 } }).lean();
    const index = memory.pendingSignups.findIndex(row => row.contactKey === contactKey && row.otpHash === otpHash && row.attempts < 5 && Date.now() - row.createdAt < 10 * 60 * 1000);
    if (index < 0) return null;
    return memory.pendingSignups.splice(index, 1)[0];
  },
  async createPendingPasswordReset(record) {
    const data = { ...record, contactKey: `${record.contactType}:${record.contact}` };
    if (isMongo()) {
      return PendingPasswordReset.findOneAndUpdate(
        { contactKey: data.contactKey }, data,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean();
    }
    const pending = { ...data, attempts: 0, createdAt: record.createdAt ?? Date.now() };
    const index = memory.pendingPasswordResets.findIndex(row => row.contactKey === data.contactKey);
    if (index < 0) memory.pendingPasswordResets.push(pending);
    else memory.pendingPasswordResets[index] = pending;
    return pending;
  },
  async findPendingPasswordReset(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingPasswordReset.findOne({
      contactKey, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    }).lean();
    const row = memory.pendingPasswordResets.find(item => item.contactKey === contactKey) || null;
    return row && Date.now() - row.createdAt < 10 * 60 * 1000 ? row : null;
  },
  async incrementPendingPasswordResetAttempts(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingPasswordReset.findOneAndUpdate({
      contactKey, createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
    }, { $inc: { attempts: 1 } }, { new: true }).lean();
    const row = memory.pendingPasswordResets.find(item => item.contactKey === contactKey);
    if (row) row.attempts += 1;
    return row || null;
  },
  async deletePendingPasswordReset(contactType, contact) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) return PendingPasswordReset.deleteOne({ contactKey });
    const index = memory.pendingPasswordResets.findIndex(row => row.contactKey === contactKey);
    if (index >= 0) memory.pendingPasswordResets.splice(index, 1);
    return { deletedCount: index >= 0 ? 1 : 0 };
  },
  async consumePendingPasswordReset(contactType, contact, otpHash) {
    const contactKey = `${contactType}:${contact}`;
    if (isMongo()) {
      return PendingPasswordReset.findOneAndDelete({
        contactKey, otpHash, attempts: { $lt: 5 },
        createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) },
      }).lean();
    }
    const index = memory.pendingPasswordResets.findIndex(row => row.contactKey === contactKey
      && row.otpHash === otpHash && row.attempts < 5
      && Date.now() - row.createdAt < 10 * 60 * 1000);
    if (index < 0) return null;
    return memory.pendingPasswordResets.splice(index, 1)[0];
  },
  async createVerified({ name, email, phone, passwordHash }) {
    if (isMongo()) {
      const doc = await User.create({ name, ...(email ? { email } : {}), ...(phone ? { phone } : {}), passwordHash });
      return doc.toObject();
    }
    const user = { id: String(Date.now()), name, ...(email ? { email } : {}), ...(phone ? { phone } : {}), passwordHash, tokenVersion: 0, role: 'farmer', location: '' };
    memory.users.push(user);
    return user;
  },
  async verifyPassword(user, password) {
    return bcrypt.compare(password, user.passwordHash);
  },
  async revokeSessions(id) {
    if (isMongo()) return User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } }, { new: true }).lean();
    const user = memory.users.find((entry) => entry.id === String(id));
    if (user) user.tokenVersion = (user.tokenVersion || 0) + 1;
    return user || null;
  },
  async updatePassword(id, password) {
    const passwordHash = await bcrypt.hash(password, 10);
    if (isMongo()) return User.findByIdAndUpdate(id, { $set: { passwordHash }, $inc: { tokenVersion: 1 } }, { new: true }).lean();
    const user = memory.users.find((entry) => entry.id === String(id));
    if (!user) return null;
    user.passwordHash = passwordHash;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    return user;
  },
  async deleteAccount(id) {
    const userId = String(id);
    if (isMongo()) {
      const session = await mongoose.startSession();
      let deleted;
      try {
        await session.withTransaction(async () => {
          const planResult = await CropPlan.deleteMany({ userId }).session(session);
          const cropResult = await Crop.deleteMany({ userId }).session(session);
          const farmResult = await Farm.deleteMany({ userId }).session(session);
          const userResult = await User.deleteOne({ _id: id }).session(session);
          deleted = {
            plans: planResult.deletedCount,
            crops: cropResult.deletedCount,
            farms: farmResult.deletedCount,
            account: userResult.deletedCount,
          };
        });
      } finally {
        await session.endSession();
      }
      return deleted;
    }

    const removeOwned = (collection) => {
      let count = 0;
      for (let index = collection.length - 1; index >= 0; index -= 1) {
        if (String(collection[index].userId) === userId) {
          collection.splice(index, 1);
          count += 1;
        }
      }
      return count;
    };
    const userIndex = memory.users.findIndex((entry) => String(entry.id) === userId);
    if (userIndex < 0) return { plans: 0, crops: 0, farms: 0, account: 0 };
    const [planCount, cropCount, farmCount] = [removeOwned(memory.plans), removeOwned(memory.crops), removeOwned(memory.farms)];
    memory.users.splice(userIndex, 1);
    return { plans: planCount, crops: cropCount, farms: farmCount, account: 1 };
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
  async updateEvent(userId, planId, eventIndex, updates) {
    const plan = await this.get(userId, planId);
    if (!plan || !plan.events[eventIndex]) return null;
    const events = plan.events.map((event) => ({ ...event }));
    events[eventIndex] = { ...events[eventIndex], ...updates };
    if ('date' in updates) events.sort((a, b) => a.date.localeCompare(b.date));
    if (isMongo()) {
      const fields = 'date' in updates
        ? { events }
        : { [`events.${eventIndex}.done`]: updates.done };
      const result = await CropPlan.updateOne({ _id: planId, userId }, { $set: fields });
      if (!result.matchedCount) return null;
      return this.get(userId, planId);
    }
    plan.events = events;
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
      const doc = await Farm.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true, runValidators: true }).lean();
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
      const doc = await Crop.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true, runValidators: true }).lean();
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
    console.log('👤 Seeded local demo farmer.');

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
