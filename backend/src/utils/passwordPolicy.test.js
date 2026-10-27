import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNewPassword } from './passwordPolicy.js';

test('allows long passphrases and does not require character-class mixing', () => {
  assert.equal(validateNewPassword('fieldwork morning harvest'), null);
});

test('rejects short passwords and values beyond bcrypt UTF-8 capacity', () => {
  assert.match(validateNewPassword('short'), /at least 12/);
  assert.match(validateNewPassword('😀'.repeat(19)), /72 UTF-8 bytes/);
  assert.equal(validateNewPassword('😀'.repeat(18)), null);
  assert.match(validateNewPassword(null), /must be text/);
});
