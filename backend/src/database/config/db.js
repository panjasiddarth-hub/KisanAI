// Database connection — MongoDB when configured, graceful in-memory fallback otherwise
import mongoose from 'mongoose';

export async function connectDB({ connect = (uri, options) => mongoose.connect(uri, options) } = {}) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    globalThis.__DB_MODE__ = 'in-memory';
    console.log('ℹ️  MONGODB_URI not set — running with in-memory store (data resets on restart).');
    return;
  }
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    await connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      autoIndex: false,
    });
    globalThis.__DB_MODE__ = 'mongodb';
    console.log('✅ Connected to MongoDB Atlas');
  } catch (err) {
    globalThis.__DB_MODE__ = 'unavailable';
    console.error('MongoDB is configured but unavailable. Refusing to start with temporary storage.');
    console.error('Check database network access and credentials, then restart the API.');
    throw new Error('Configured MongoDB is unavailable; API startup stopped to protect farmer data.');
  }
}
