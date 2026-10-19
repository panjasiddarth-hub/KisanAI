import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SOIL_REPORT_DIR = process.env.SOIL_REPORT_DIR || path.join(BACKEND_DIR, 'uploads-private', 'soil-reports');
export const MAX_SOIL_REPORT_BYTES = 8 * 1024 * 1024;

const REPORT_ID = /^[a-f0-9]{32}\.(pdf|jpg|png|webp)$/;
const FILE_TYPES = {
  pdf: { mimeType: 'application/pdf', extension: 'pdf' },
  jpg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
  webp: { mimeType: 'image/webp', extension: 'webp' },
};

export const soilReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SOIL_REPORT_BYTES, files: 1, fields: 2 },
});

export class SoilReportError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function detectSoilReportType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) return null;
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return FILE_TYPES.pdf;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return FILE_TYPES.jpg;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return FILE_TYPES.png;
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') return FILE_TYPES.webp;
  return null;
}

export async function saveSoilReport(userId, file, type) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(userId))) {
    throw new SoilReportError(400, 'Could not safely store this report.');
  }
  const id = `${crypto.randomBytes(16).toString('hex')}.${type.extension}`;
  const directory = path.join(SOIL_REPORT_DIR, String(userId));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, id), file.buffer, { flag: 'wx', mode: 0o600 });

  const originalName = String(file.originalname || 'soil-report')
    .replace(/[/\\]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 120) || 'soil-report';

  return {
    id,
    name: originalName,
    mimeType: type.mimeType,
    size: file.buffer.length,
    uploadedAt: new Date().toISOString(),
  };
}

export async function readSoilReport(userId, id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(userId)) || !REPORT_ID.test(String(id))) return null;
  try {
    const buffer = await fs.readFile(path.join(SOIL_REPORT_DIR, String(userId), id));
    const extension = id.slice(id.lastIndexOf('.') + 1);
    return { buffer, mimeType: FILE_TYPES[extension].mimeType };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteSoilReport(userId, id) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(userId)) || !REPORT_ID.test(String(id))) return false;
  try {
    await fs.unlink(path.join(SOIL_REPORT_DIR, String(userId), id));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function soilReportUploadError(error) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return { status: 413, message: `Report too large. The limit is ${MAX_SOIL_REPORT_BYTES / 1024 / 1024} MB.` };
  }
  if (error?.name === 'MulterError') return { status: 400, message: `Report upload rejected: ${error.message}` };
  return null;
}
