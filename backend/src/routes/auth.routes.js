// src/routes/auth.routes.js — /api/auth/*
import { Router } from 'express';
import { users } from '../repositories/store.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'name, email and password are required' });
    }
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await users.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' });

    const user = await users.create({ name: name.trim(), email, password });
    res.status(201).json({ token: signToken(user), user: users.public(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const user = await users.findByEmail(email);
    if (!user || !(await users.verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: users.public(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: users.public(req.user) });
});

export default router;
