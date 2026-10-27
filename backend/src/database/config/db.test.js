import test from 'node:test';
import assert from 'node:assert/strict';
import { connectDB } from './db.js';

const originalUri = process.env.MONGODB_URI;
const originalMode = globalThis.__DB_MODE__;

function restoreEnvironment() {
  if (originalUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = originalUri;
  if (originalMode === undefined) delete globalThis.__DB_MODE__;
  else globalThis.__DB_MODE__ = originalMode;
}

test('uses in-memory mode only when MongoDB is not configured', async (t) => {
  t.after(restoreEnvironment);
  delete process.env.MONGODB_URI;
  let connectCalled = false;

  await connectDB({ connect: async () => { connectCalled = true; } });

  assert.equal(connectCalled, false);
  assert.equal(globalThis.__DB_MODE__, 'in-memory');
});

test('stops startup rather than falling back when configured MongoDB is unavailable', async (t) => {
  t.after(restoreEnvironment);
  process.env.MONGODB_URI = 'mongodb://test.invalid/kisanai';

  await assert.rejects(
    connectDB({ connect: async () => { throw new Error('simulated connection failure'); } }),
    /API startup stopped to protect farmer data/
  );
  assert.equal(globalThis.__DB_MODE__, 'unavailable');
});

test('uses MongoDB mode after a successful connection', async (t) => {
  t.after(restoreEnvironment);
  process.env.MONGODB_URI = 'mongodb://test.invalid/kisanai';
  let receivedOptions;

  await connectDB({ connect: async (_uri, options) => { receivedOptions = options; } });

  assert.equal(globalThis.__DB_MODE__, 'mongodb');
  assert.equal(receivedOptions.serverSelectionTimeoutMS, 15000);
});
