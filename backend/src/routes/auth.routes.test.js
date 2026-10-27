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

test('email signup is pending until OTP verification, then supports email login', async (t) => {
  globalThis.__DB_MODE__ = 'in-memory';
  process.env.OTP_DELIVERY_PROVIDER = 'console';
  const originalInfo = console.info;
  let capturedOtp = '';
  console.info = (...args) => { capturedOtp = String(args.at(-1)).match(/\b\d{6}\b/)?.[0] || ''; };
  t.after(() => { console.info = originalInfo; });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const invalid = await post('/register', { name: 'OTP Farmer', contactType: 'email', contact: 'farmer@localhost', password: 'long memorable passphrase' });
  assert.equal(invalid.status, 400);
  const email = `otp-${Date.now()}@example.test`;
  const started = await post('/register', { name: 'OTP Farmer', contactType: 'email', contact: email, password: 'long memorable passphrase' });
  assert.equal(started.status, 202);
  assert.ok(capturedOtp);
  assert.equal(await users.findByEmail(email), null);
  assert.equal((await post('/verify-otp', { contactType: 'email', contact: email, code: '000000' })).status, 400);
  const verified = await post('/verify-otp', { contactType: 'email', contact: email, code: capturedOtp });
  assert.equal(verified.status, 201);
  const { user } = await verified.json();
  assert.equal(user.email, email);
  assert.equal((await post('/login', { identifier: email, password: 'long memorable passphrase' })).status, 200);
});

test('phone signup requires E.164 and supports phone login after OTP verification', async (t) => {
  globalThis.__DB_MODE__ = 'in-memory';
  process.env.OTP_DELIVERY_PROVIDER = 'console';
  const originalInfo = console.info;
  let capturedOtp = '';
  console.info = (...args) => { capturedOtp = String(args.at(-1)).match(/\b\d{6}\b/)?.[0] || ''; };
  t.after(() => { console.info = originalInfo; });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (path, body) => fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  assert.equal((await post('/register', { name: 'Phone Farmer', contactType: 'phone', contact: '9876543210', password: 'long memorable passphrase' })).status, 400);
  const phone = `+9198765${String(Date.now()).slice(-5)}`;
  const started = await post('/register', { name: 'Phone Farmer', contactType: 'phone', contact: phone, password: 'long memorable passphrase' });
  assert.equal(started.status, 202);
  const verified = await post('/verify-otp', { contactType: 'phone', contact: phone, code: capturedOtp });
  assert.equal(verified.status, 201);
  assert.equal((await post('/login', { identifier: phone, password: 'long memorable passphrase' })).status, 200);
});

test('password reset is generic for unknown accounts, expires, limits attempts, and revokes sessions', async (t) => {
  globalThis.__DB_MODE__ = 'in-memory';
  process.env.OTP_DELIVERY_PROVIDER = 'console';
  process.env.NODE_ENV = 'test';
  const originalInfo = console.info;
  let capturedOtp = '';
  console.info = (...args) => { capturedOtp = String(args.at(-1)).match(/\b\d{6}\b/)?.[0] || ''; };
  t.after(() => { console.info = originalInfo; });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth`;
  const post = (path, body) => fetch(`${baseUrl}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const email = `reset-${Date.now()}@example.test`;
  const oldPassword = 'original fieldwork passphrase';
  const newPassword = 'updated fieldwork passphrase';
  const user = await users.create({ name: 'Reset Farmer', email, password: oldPassword });

  const unknown = await post('/forgot-password', { contactType: 'email', contact: 'unknown@example.test' });
  assert.equal(unknown.status, 202);
  assert.match((await unknown.json()).message, /If an account matches/);
  const initialLogin = await post('/login', { identifier: email, password: oldPassword });
  const oldToken = (await initialLogin.json()).token;

  assert.equal((await post('/forgot-password', { contactType: 'email', contact: email })).status, 202);
  const firstCode = capturedOtp;
  assert.match(firstCode, /^\d{6}$/);
  assert.equal((await post('/reset-password', { contactType: 'email', contact: email, code: '000000', newPassword })).status, 400);
  const pending = await users.findPendingPasswordReset('email', email);
  assert.equal(pending.attempts, 1);
  await users.deletePendingPasswordReset('email', email);
  await users.createPendingPasswordReset({
    contactType: 'email', contact: email, userId: user.id, otpHash: pending.otpHash,
    createdAt: Date.now() - 11 * 60 * 1000,
  });
  assert.equal((await post('/reset-password', { contactType: 'email', contact: email, code: firstCode, newPassword })).status, 400);
  await users.deletePendingPasswordReset('email', email);

  assert.equal((await post('/forgot-password', { contactType: 'email', contact: email })).status, 202);
  const limitedCode = capturedOtp;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await post('/reset-password', { contactType: 'email', contact: email, code: '000000', newPassword });
    assert.equal(response.status, attempt === 4 ? 429 : 400);
  }
  assert.equal(await users.findPendingPasswordReset('email', email), null);

  assert.equal((await post('/forgot-password', { contactType: 'email', contact: email })).status, 202);
  const validCode = capturedOtp;
  assert.notEqual(validCode, limitedCode); // random code rotation after invalid-attempt lockout
  assert.equal((await post('/reset-password', { contactType: 'email', contact: email, code: validCode, newPassword })).status, 200);
  assert.equal((await fetch(`${baseUrl}/me`, { headers: { Authorization: `Bearer ${oldToken}` } })).status, 401);
  assert.equal((await post('/login', { identifier: email, password: oldPassword })).status, 401);
  assert.equal((await post('/login', { identifier: email, password: newPassword })).status, 200);

  const phone = `+9198765${String(Date.now()).slice(-5)}`;
  const phoneUser = await users.create({ name: 'Phone Reset Farmer', phone, password: oldPassword });
  assert.equal((await post('/forgot-password', { contactType: 'phone', contact: phone })).status, 202);
  const phoneCode = capturedOtp;
  assert.match(phoneCode, /^\d{6}$/);
  assert.equal((await post('/reset-password', { contactType: 'phone', contact: phone, code: phoneCode, newPassword })).status, 200);
  assert.equal(await users.verifyPassword(await users.findById(phoneUser.id), newPassword), true);
});
