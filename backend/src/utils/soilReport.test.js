import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanSoilExtraction, verifiedSoilReportMime } from './soilReport.js';

test('recognizes PDF and image soil reports from their file signatures', () => {
  assert.equal(verifiedSoilReportMime(Buffer.from('%PDF-1.7\n')), 'application/pdf');
  assert.equal(verifiedSoilReportMime(Buffer.from([0xff, 0xd8, 0xff, 0x00])), 'image/jpeg');
  assert.equal(verifiedSoilReportMime(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(verifiedSoilReportMime(Buffer.from('RIFFxxxxWEBP', 'ascii')), 'image/webp');
  assert.equal(verifiedSoilReportMime(Buffer.from('not a supported report')), null);
  assert.equal(verifiedSoilReportMime('not a buffer'), null);
});

test('keeps only bounded numeric soil measurements and valid report dates', () => {
  const result = cleanSoilExtraction({
    soilPH: { value: 6.4, unit: null, confidence: 'high' },
    soilEC: { value: 0.8, unit: 'dS/m', confidence: 'medium' },
    soilOC: { value: 0.7, unit: '%', confidence: 'high' },
    soilN: { value: 100, unit: 'kg/ha', confidence: 'high' },
    soilP: { value: '40', unit: 'kg/ha', confidence: 'high' },
    soilMn: { value: 1_000_001, unit: 'ppm', confidence: 'unknown' },
    soilTestDate: '2026-02-30',
  });
  assert.equal(result.soilPH.value, 6.4);
  assert.equal(result.soilEC.value, 0.8);
  assert.equal(result.soilOC.value, 0.7);
  assert.equal(result.soilN.value, 100);
  assert.equal(result.soilP.value, null);
  assert.equal(result.soilMn.value, null);
  assert.equal(result.soilMn.confidence, 'low');
  assert.equal(result.soilTestDate, null);
  assert.equal(result.soilZn.value, null);
});
