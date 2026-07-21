// src/middleware/auth.js — JWT bearer auth
import jwt from 'jsonwebtoken';
import { users } from '../repositories/store.js';

const SECRET = () => process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign({ id: String(user._id || user.id) }, SECRET(), { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    const payload = jwt.verify(token, SECRET());
    const user = await users.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.userId = payload.id;
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
