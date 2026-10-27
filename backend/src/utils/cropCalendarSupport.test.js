import test from 'node:test';
import assert from 'node:assert/strict';
import { annotateCalendarSupport } from './cropCalendarSupport.js';

test('marks calendar support without changing crop model ranking or scores', () => {
  const result = {
    prediction: 'coffee',
    recommendations: [
      { crop: 'coffee', rank: 1, confidence: 37.67 },
      { crop: 'maize', rank: 2, confidence: 34 },
    ],
  };

  const annotated = annotateCalendarSupport(result, ['Maize', 'Cotton']);

  assert.equal(annotated.prediction, 'coffee');
  assert.deepEqual(annotated.recommendations.map(({ crop, rank, confidence, calendarSupported }) => ({
    crop, rank, confidence, calendarSupported,
  })), [
    { crop: 'coffee', rank: 1, confidence: 37.67, calendarSupported: false },
    { crop: 'maize', rank: 2, confidence: 34, calendarSupported: true },
  ]);
  assert.equal(result.recommendations[0].calendarSupported, undefined);
});
