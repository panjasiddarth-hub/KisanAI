// src/routes/auth.routes.js — /api/auth/*
import { Router } from 'express';
import { crops, farms, plans, users } from '../database/repositories/store.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateNewPassword } from '../utils/passwordPolicy.js';

const router = Router();
const loginRateLimit = createRateLimiter({ name: 'auth-login', windowMs: 15 * 60 * 1000, limit: 10 });
const registerRateLimit = createRateLimiter({ name: 'auth-register', windowMs: 60 * 60 * 1000, limit: 5 });
const passwordChangeRateLimit = createRateLimiter({
  name: 'auth-password-change',
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `user:${req.userId || req.ip || 'unknown'}`,
});
const accountDeleteRateLimit = createRateLimiter({
  name: 'auth-account-delete',
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => `user:${req.userId || req.ip || 'unknown'}`,
});
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'name, email and password must be strings' });
    }
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedName || normalizedName.length > 80) {
      return res.status(400).json({ error: 'Name must contain 1 to 80 characters' });
    }
    if (normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    const passwordIssue = validateNewPassword(password);
    if (passwordIssue) return res.status(400).json({ error: passwordIssue });
    if (await users.findByEmail(normalizedEmail)) return res.status(409).json({ error: 'Email already registered' });

    let user;
    try {
      user = await users.create({ name: normalizedName, email: normalizedEmail, password });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: 'Email already registered' });
      throw error;
    }
    res.status(201).json({ token: signToken(user), user: users.public(user) });
  } catch (e) { next(e); }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email and password must be strings' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail) || password.length > 128) {
      return res.status(400).json({ error: 'Email or password format is invalid' });
    }
    const user = await users.findByEmail(normalizedEmail);
    if (!user || !(await users.verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: signToken(user), user: users.public(user) });
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: users.public(req.user) });
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await users.revokeSessions(req.userId);
    res.json({ ok: true, message: 'Signed out. All active sessions have been revoked.' });
  } catch (error) { next(error); }
});

router.post('/change-password', requireAuth, passwordChangeRateLimit, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 128) {
      return res.status(400).json({ error: 'Enter your current password.' });
    }
    const passwordIssue = validateNewPassword(newPassword);
    if (passwordIssue) return res.status(400).json({ error: passwordIssue });
    if (!(await users.verifyPassword(req.user, currentPassword))) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
    if (await users.verifyPassword(req.user, newPassword)) {
      return res.status(400).json({ error: 'Choose a password different from your current password.' });
    }
    const updatedUser = await users.updatePassword(req.userId, newPassword);
    if (!updatedUser) return res.status(401).json({ error: 'Account not found. Please sign in again.' });
    res.json({ token: signToken(updatedUser), user: users.public(updatedUser) });
  } catch (error) { next(error); }
});

router.get('/export', requireAuth, async (req, res, next) => {
  try {
    const [farmerFarms, farmerCrops, farmerPlans] = await Promise.all([
      farms.list(req.userId),
      crops.list(req.userId),
      plans.list(req.userId),
    ]);
    res.setHeader('Content-Disposition', 'attachment; filename="kisanai-account-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
      account: users.public(req.user),
      farms: farmerFarms,
      crops: farmerCrops,
      cropPlans: farmerPlans,
    });
  } catch (error) { next(error); }
});

router.delete('/account', requireAuth, accountDeleteRateLimit, async (req, res, next) => {
  try {
    const { password, confirmEmail } = req.body || {};
    if (typeof password !== 'string' || !password || password.length > 128) {
      return res.status(400).json({ error: 'Enter your password to confirm account deletion.' });
    }
    if (!(await users.verifyPassword(req.user, password))) {
      return res.status(400).json({ error: 'Password is incorrect.' });
    }
    if (typeof confirmEmail !== 'string' || confirmEmail.trim().toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Type your account email exactly to confirm deletion.' });
    }
    const deleted = await users.deleteAccount(req.userId);
    if (!deleted?.account) return res.status(404).json({ error: 'Account not found.' });
    res.json({ ok: true, deleted: { farms: deleted.farms, crops: deleted.crops, cropPlans: deleted.plans } });
  } catch (error) { next(error); }
});

export default router;
