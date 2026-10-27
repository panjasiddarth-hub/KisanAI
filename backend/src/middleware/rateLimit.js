import { consumeRateLimitBucket } from '../database/repositories/rateLimitStore.js';

// MongoDB mode shares counters across API instances. The in-memory demo mode
// remains process-local because it has no durable/shared database.
export function createRateLimiter({ name = 'api', windowMs, limit, keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown', now = Date.now, store }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0) throw new TypeError('windowMs must be positive');
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError('limit must be a positive integer');

  const buckets = new Map();

  return async function rateLimit(req, res, next) {
    const currentTime = now();
    const key = String(keyGenerator(req));
    let bucket;
    if (store || globalThis.__DB_MODE__ === 'mongodb') {
      try {
        bucket = store
          ? await store({ name, clientKey: key, windowMs, now: currentTime })
          : await consumeRateLimitBucket({ name, clientKey: key, windowMs, now: currentTime });
      } catch {
        return res.status(503).json({ error: 'Request protection is temporarily unavailable. Please try again.' });
      }
    } else {
      bucket = buckets.get(key);
      if (!bucket || currentTime >= bucket.resetAt) {
        bucket = { count: 0, resetAt: currentTime + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (buckets.size > 10_000) {
        for (const [bucketKey, value] of buckets) {
          if (currentTime >= value.resetAt) buckets.delete(bucketKey);
        }
      }
    }

    const remaining = Math.max(0, limit - bucket.count);
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    return next();
  };
}
