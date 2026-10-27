import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoDefaultDemoCredentials,
  createCorsOptions,
  getJwtSecret,
  parseCorsOrigins,
  parseTrustProxyHops,
  shouldSeedDemoUser,
  validateProductionEnvironment,
} from './runtimeConfig.js';

test('uses local frontend origins during development', () => {
  assert.deepEqual(parseCorsOrigins({ NODE_ENV: 'development' }), [
    'http://localhost:5173', 'http://127.0.0.1:5173',
  ]);
});

test('requires an exact frontend allowlist in production', () => {
  assert.throws(() => parseCorsOrigins({ NODE_ENV: 'production' }), /CORS_ORIGINS/);
  assert.deepEqual(parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example,https://admin.example' }), [
    'https://app.example', 'https://admin.example',
  ]);
  assert.throws(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: '*' }), /exact HTTP/);
  assert.throws(() => parseCorsOrigins({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example/path' }), /exact HTTP/);
});

test('CORS accepts only allowlisted browser origins while allowing originless clients', () => {
  const { origin } = createCorsOptions({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.example' });
  origin(undefined, (_error, allowed) => assert.equal(allowed, true));
  origin('https://app.example', (_error, allowed) => assert.equal(allowed, true));
  origin('https://attacker.example', (_error, allowed) => assert.equal(allowed, false));
});

test('parses proxy hop count safely', () => {
  assert.equal(parseTrustProxyHops(undefined), 0);
  assert.equal(parseTrustProxyHops('2'), 2);
  assert.throws(() => parseTrustProxyHops('true'), /integer/);
  assert.throws(() => parseTrustProxyHops('11'), /integer/);
});

test('requires persistent storage and a long JWT secret in production', () => {
  const valid = {
    NODE_ENV: 'production',
    MONGODB_URI: 'mongodb://database.example/kisanai',
    JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
    CORS_ORIGINS: 'https://app.example',
    TRUST_PROXY_HOPS: '1',
  };
  assert.doesNotThrow(() => validateProductionEnvironment(valid));
  assert.throws(() => validateProductionEnvironment({ ...valid, MONGODB_URI: '' }), /MONGODB_URI/);
  assert.throws(() => validateProductionEnvironment({ ...valid, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production' }), /JWT_SECRET/);
  assert.equal(getJwtSecret({ NODE_ENV: 'development' }), 'dev-secret-change-me');
});

test('does not seed the demo login in production and rejects its default password', async () => {
  assert.equal(shouldSeedDemoUser({ NODE_ENV: 'development' }), true);
  assert.equal(shouldSeedDemoUser({ NODE_ENV: 'production' }), false);
  const demoUsers = {
    async findByEmail() { return { email: 'siddarth@kisan.com' }; },
    async verifyPassword(_user, password) { return password === 'password123'; },
  };
  await assert.rejects(assertNoDefaultDemoCredentials(demoUsers, { NODE_ENV: 'production' }), /default demo account/);
  await assert.doesNotReject(assertNoDefaultDemoCredentials(demoUsers, { NODE_ENV: 'development' }));
});
