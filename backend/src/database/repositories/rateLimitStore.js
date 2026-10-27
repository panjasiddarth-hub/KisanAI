import { createHash } from 'node:crypto';
import { RateLimitBucket } from '../models/RateLimitBucket.js';

export async function consumeRateLimitBucket({ name, clientKey, windowMs, now = Date.now() }) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const id = createHash('sha256').update(`${name}\0${clientKey}\0${windowStart}`).digest('hex');
  const expiresAt = new Date(windowStart + windowMs * 2);
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
  let bucket;
  try {
    bucket = await RateLimitBucket.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true });
  } catch (error) {
    // Concurrent first requests can race on the upsert; retry as an update.
    if (error?.code !== 11000) throw error;
    bucket = await RateLimitBucket.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true });
  }
  return { count: bucket.count, resetAt: windowStart + windowMs };
}
