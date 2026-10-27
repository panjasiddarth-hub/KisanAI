// Shared, TTL-cleaned rate-limit counters for API instances using MongoDB.
import mongoose from 'mongoose';

const rateLimitBucketSchema = new mongoose.Schema({
  _id: { type: String },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, collection: 'rate_limit_buckets' });

rateLimitBucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucket = mongoose.models.RateLimitBucket
  || mongoose.model('RateLimitBucket', rateLimitBucketSchema);

export async function ensureRateLimitIndexes() {
  await RateLimitBucket.createIndexes();
}
