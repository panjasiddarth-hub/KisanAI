// src/middleware/auth.js — JWT bearer auth
import jwt from 'jsonwebtoken';
import { users } from '../database/repositories/store.js';
import { getJwtSecret } from '../config/runtimeConfig.js';

const SECRET = () => getJwtSecret();

export function hasCurrentSessionVersion(payload, user) {
  return Number(payload?.ver || 0) === Number(user?.tokenVersion || 0);
}

export function signToken(user) {
  return jwt.sign({ id: String(user._id || user.id), ver: Number(user.tokenVersion || 0) }, SECRET(), { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    const payload = jwt.verify(token, SECRET());
    const user = await users.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!hasCurrentSessionVersion(payload, user)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    const userId = String(user._id || user.id || payload.id);
    req.userId = userId;
    req.user = { ...user, id: userId };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
