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
    console.log('🔄 Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    globalThis.__DB_MODE__ = 'mongodb';
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    globalThis.__DB_MODE__ = 'in-memory';
    console.warn('⚠️  MongoDB connection failed, falling back to in-memory store.');
    console.warn('   Error:', err.message);
    console.warn('   Tip: Make sure your IP is whitelisted in MongoDB Atlas → Network Access.');
  }
}

