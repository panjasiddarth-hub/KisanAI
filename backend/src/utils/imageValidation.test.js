import test from 'node:test';
import assert from 'node:assert/strict';
import { detectImageMime, isAllowedDiseaseImage } from './imageValidation.js';

test('recognizes JPEG and PNG signatures', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectImageMime(jpeg), 'image/jpeg');
  assert.equal(detectImageMime(png), 'image/png');
  assert.equal(detectImageMime(Buffer.from('not an image')), null);
});

test('requires the declared MIME type to match the actual image signature', () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(isAllowedDiseaseImage({ mimetype: 'image/jpeg', buffer: jpeg }), true);
  assert.equal(isAllowedDiseaseImage({ mimetype: 'image/png', buffer: jpeg }), false);
  assert.equal(isAllowedDiseaseImage({ mimetype: 'text/plain', buffer: jpeg }), false);
});
