import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkflowStatus } from './orchestratorService.js';

test('reports the correct terminal state when every requested agent is unavailable', () => {
  assert.equal(resolveWorkflowStatus({ crop: { status: 'failed' }, fertilizer: { status: 'failed' } }), 'failed');
});

test('reports missing farm inputs when no agent can run yet', () => {
  assert.equal(resolveWorkflowStatus({ crop: { status: 'needs_input' }, fertilizer: { status: 'needs_input' } }), 'needs_input');
});

test('reports partial results when one agent completes and another needs input', () => {
  assert.equal(resolveWorkflowStatus({ crop: { status: 'completed' }, fertilizer: { status: 'needs_input' } }), 'partial');
});

test('reports review when every returned result is blocked by validation', () => {
  assert.equal(resolveWorkflowStatus({ crop: { status: 'needs_review' } }), 'needs_review');
});
