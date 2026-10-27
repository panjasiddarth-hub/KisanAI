import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAllowedFields } from './requestFields.js';

test('keeps only explicitly editable fields', () => {
  const result = pickAllowedFields(
    { name: 'North plot', userId: 'someone-else', healthScore: 100, _id: 'forged' },
    ['name']
  );

  assert.deepEqual(result, { name: 'North plot' });
});

test('rejects non-object and array payloads', () => {
  assert.deepEqual(pickAllowedFields(null, ['name']), {});
  assert.deepEqual(pickAllowedFields('name', ['name']), {});
  assert.deepEqual(pickAllowedFields(['name'], ['name']), {});
});

test('does not copy prototype or internal fields unless explicitly allowed', () => {
  const payload = JSON.parse('{"name":"Farm","__proto__":{"admin":true},"constructor":"unsafe"}');
  const result = pickAllowedFields(payload, ['name']);

  assert.deepEqual(result, { name: 'Farm' });
  assert.equal(Object.hasOwn(result, '__proto__'), false);
  assert.equal(Object.hasOwn(result, 'constructor'), false);
});
