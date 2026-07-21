// src/config/db.js — MongoDB when configured, graceful in-memory fallback otherwise
import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    globalThis.__DB_MODE__ = 'in-memory';
    console.log('ℹ️  MONGODB_URI not set — running with in-memory store (data resets on restart).');
    return;
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 });
    globalThis.__DB_MODE__ = 'mongodb';
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    globalThis.__DB_MODE__ = 'in-memory';
    console.warn('⚠️  MongoDB connection failed, falling back to in-memory store:', err.message);
  }
}
