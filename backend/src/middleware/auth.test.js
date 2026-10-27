import test from 'node:test';
import assert from 'node:assert/strict';
import { hasCurrentSessionVersion } from './auth.js';

test('recognizes current token versions and rejects revoked or old sessions', () => {
  const user = { tokenVersion: 2 };
  assert.equal(hasCurrentSessionVersion({ ver: 2 }, user), true);
  assert.equal(hasCurrentSessionVersion({ ver: 1 }, user), false);
  assert.equal(hasCurrentSessionVersion({}, user), false);
  assert.equal(hasCurrentSessionVersion({}, { tokenVersion: 0 }), true);
});
