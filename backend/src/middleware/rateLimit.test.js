import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from './rateLimit.js';

function responseRecorder() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    setHeader(name, value) { headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('limits requests by key and resets after the time window', async () => {
  let currentTime = 1_000;
  globalThis.__DB_MODE__ = 'in-memory';
  const limiter = createRateLimiter({ windowMs: 1_000, limit: 2, now: () => currentTime });
  const request = { ip: 'farmer-ip' };
  const next = () => {};

  const first = responseRecorder();
  await limiter(request, first, next);
  assert.equal(first.statusCode, 200);
  assert.equal(first.headers['RateLimit-Remaining'], '1');

  const second = responseRecorder();
  await limiter(request, second, next);
  assert.equal(second.statusCode, 200);

  const third = responseRecorder();
  await limiter(request, third, next);
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers['Retry-After'], '1');

  currentTime += 1_000;
  const afterReset = responseRecorder();
  await limiter(request, afterReset, next);
  assert.equal(afterReset.statusCode, 200);
});

test('isolates buckets by client key', async () => {
  globalThis.__DB_MODE__ = 'in-memory';
  const limiter = createRateLimiter({ windowMs: 1_000, limit: 1, now: () => 1_000 });
  const next = () => {};
  await limiter({ ip: 'one' }, responseRecorder(), next);
  const otherClient = responseRecorder();
  await limiter({ ip: 'two' }, otherClient, next);
  assert.equal(otherClient.statusCode, 200);
});

test('separate limiter instances share counters through a shared store', async () => {
  const shared = new Map();
  const store = async ({ name, clientKey, windowMs, now }) => {
    const key = `${name}:${clientKey}:${Math.floor(now / windowMs)}`;
    const bucket = shared.get(key) || { count: 0, resetAt: (Math.floor(now / windowMs) + 1) * windowMs };
    bucket.count += 1;
    shared.set(key, bucket);
    return bucket;
  };
  const options = { name: 'multi-instance-test', windowMs: 1_000, limit: 1, now: () => 1_000, store };
  const firstInstance = createRateLimiter(options);
  const secondInstance = createRateLimiter(options);
  const next = () => {};
  const first = responseRecorder();
  const second = responseRecorder();

  await firstInstance({ ip: 'same-farmer' }, first, next);
  await secondInstance({ ip: 'same-farmer' }, second, next);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 429);
});
