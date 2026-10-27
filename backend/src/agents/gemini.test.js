import test from 'node:test';
import assert from 'node:assert/strict';
import { soilOcrProviderFailure } from './gemini.js';

test('gives a clear setup message when Gemini reports an invalid API key as HTTP 400', () => {
  const result = soilOcrProviderFailure(400, JSON.stringify({
    error: {
      message: 'API key not valid. Please pass a valid API key.',
      details: [{ reason: 'API_KEY_INVALID' }],
    },
  }));

  assert.equal(result.code, 'GEMINI_OCR_INVALID_KEY');
  assert.match(result.message, /rejected the configured API key/i);
});

test('reports quota failures without exposing provider request details', () => {
  const result = soilOcrProviderFailure(429, '{"error":{"message":"quota exceeded"}}');
  assert.equal(result.code, 'GEMINI_OCR_QUOTA');
  assert.match(result.message, /quota or rate limit/i);
});

test('uses a bounded generic message for other provider failures', () => {
  const result = soilOcrProviderFailure(500, 'upstream error');
  assert.equal(result.code, 'GEMINI_OCR_PROVIDER_ERROR');
  assert.equal(result.message, 'Gemini could not process the report (HTTP 500). Check backend terminal for details.');
});
