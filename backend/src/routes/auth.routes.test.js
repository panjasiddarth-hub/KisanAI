import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import authRoutes from './auth.routes.js';
import { crops, farms, plans, users } from '../database/repositories/store.js';

test('password change and logout revoke sessions while preserving account access', async (t) => {
  globalThis.__DB_MODE__ = 'in-memory';
  const email = `auth-flow-${Date.now()}@example.test`;
  const testUser = await users.create({ name: 'Test Farmer', email, password: 'local test password' });
  const otherUser = await users.create({ name: 'Other Farmer', email: `other-${Date.now()}@example.test`, password: 'other farmer password' });
  await farms.create({ userId: testUser.id, name: 'Test Farm', location: 'Test Village', area: 2 });
  await farms.create({ userId: otherUser.id, name: 'Other Farm', location: 'Other Village', area: 3 });
  await crops.create({ userId: testUser.id, farmId: 'test-farm', name: 'Rice', area: 1 });
  await crops.create({ userId: otherUser.id, farmId: 'other-farm', name: 'Wheat', area: 1 });
  await plans.create({ userId: testUser.id, crop: 'Rice', sowingDate: '2026-06-01', events: [] });
  await plans.create({ userId: otherUser.id, crop: 'Wheat', sowingDate: '2026-11-01', events: [] });

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (path, body, token) => fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const originalLogin = await post('/login', { email, password: 'local test password' });
  assert.equal(originalLogin.status, 200);
  const originalToken = (await originalLogin.json()).token;

  const rejectedChange = await post('/change-password', {
    currentPassword: 'local test password', newPassword: 'too short',
  }, originalToken);
  assert.equal(rejectedChange.status, 400);
  assert.match((await rejectedChange.json()).error, /at least 12/);

  const changed = await post('/change-password', {
    currentPassword: 'local test password', newPassword: 'new fieldwork passphrase 2026',
  }, originalToken);
  assert.equal(changed.status, 200);
  const newToken = (await changed.json()).token;
  assert.equal((await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${originalToken}` } })).status, 401);
  assert.equal((await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${newToken}` } })).status, 200);

  assert.equal((await post('/logout', {}, newToken)).status, 200);
  assert.equal((await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${newToken}` } })).status, 401);
  assert.equal((await post('/login', { email, password: 'local test password' })).status, 401);
  const finalLogin = await post('/login', { email, password: 'new fieldwork passphrase 2026' });
  assert.equal(finalLogin.status, 200);
  const deletionToken = (await finalLogin.json()).token;

  const exported = await fetch(`${baseUrl}/export`, { headers: { Authorization: `Bearer ${deletionToken}` } });
  assert.equal(exported.status, 200);
  const data = await exported.json();
  assert.equal(data.farms.length, 1);
  assert.equal(data.crops.length, 1);
  assert.equal(data.cropPlans.length, 1);
  assert.equal('passwordHash' in data.account, false);

  const wrongConfirmation = await fetch(`${baseUrl}/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deletionToken}` },
    body: JSON.stringify({ password: 'new fieldwork passphrase 2026', confirmEmail: 'wrong@example.test' }),
  });
  assert.equal(wrongConfirmation.status, 400);
  assert.equal((await users.findById(testUser.id)) !== null, true);

  const deleted = await fetch(`${baseUrl}/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deletionToken}` },
    body: JSON.stringify({ password: 'new fieldwork passphrase 2026', confirmEmail: email }),
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await deleted.json()).deleted, { farms: 1, crops: 1, cropPlans: 1 });
  assert.equal(await users.findById(testUser.id), null);
  assert.equal((await farms.list(otherUser.id)).length, 1);
  assert.equal((await crops.list(otherUser.id)).length, 1);
  assert.equal((await plans.list(otherUser.id)).length, 1);
});
