// src/services/photoStore.js — private storage for farmer-uploaded photos.
//
// Replaces the public /uploads folder (any file, any extension, served to anyone). Now:
// - the type is detected from the file's bytes (JPEG, PNG or WebP only); the client's file name and
//   extension are ignored, so an uploaded .html/.svg can never be stored or served;
// - at most 5 MB and one file per request;
// - stored outside any static folder as <PHOTO_DIR>/<userId>/<random id>.<ext> (dirs 0700, files 0600);
// - read back only through an authenticated route that looks in the caller's own folder, so another
//   farmer's photo id simply isn't found (404).
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const PHOTO_DIR = process.env.PHOTO_DIR || path.join(BACKEND_DIR, 'uploads-private');
const ID_RE = /^[a-f0-9]{32}\.(jpg|png|webp)$/;
const USER_RE = /^[A-Za-z0-9_-]{1,64}$/;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// Multer keeps the upload in memory (bounded by the limits) until its bytes are checked.
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 20, fieldSize: 64 * 1024 },
});

export class PhotoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// File type from magic bytes, never from the name or the client's Content-Type.
export function detectImageType(buf) {
  if (!buf || buf.length < 32) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}

export async function savePhoto(userId, file) {
  if (!USER_RE.test(String(userId))) throw new PhotoError(400, 'Invalid user');
  const ext = detectImageType(file?.buffer);
  if (!ext) throw new PhotoError(415, 'Only JPEG, PNG or WebP photos are accepted (the file content was not a recognised image).');
  const dir = path.join(PHOTO_DIR, String(userId));
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  await fs.chmod(PHOTO_DIR, 0o700).catch(() => {});
  const id = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(dir, id), file.buffer, { mode: 0o600, flag: 'wx' });
  return { id, bytes: file.buffer.length, type: MIME[ext], url: `/api/agents/disease/photos/${id}` };
}

// Absolute path of a stored photo (validated id) — for server-side use only.
export function photoPath(userId, id) {
  if (!USER_RE.test(String(userId)) || !ID_RE.test(String(id))) throw new PhotoError(400, 'Invalid photo id');
  return path.join(PHOTO_DIR, String(userId), id);
}

// Owner-only read. Returns null when the id is malformed or the file isn't in the caller's folder.
export async function readPhoto(userId, id) {
  if (!USER_RE.test(String(userId)) || !ID_RE.test(String(id))) return null;
  try {
    const data = await fs.readFile(path.join(PHOTO_DIR, String(userId), id));
    return { data, type: MIME[id.split('.').pop()] };
  } catch {
    return null;
  }
}

// Multer limit errors → clear 413/400 responses instead of a generic 500.
export function uploadErrorStatus(err) {
  if (err?.code === 'LIMIT_FILE_SIZE') return { status: 413, error: `Photo too large — the limit is ${MAX_PHOTO_BYTES / 1024 / 1024} MB.` };
  if (err?.name === 'MulterError') return { status: 400, error: `Upload rejected: ${err.message}` };
  return null;
}
