// src/routes/auth.routes.js — /api/auth/*
import { Router } from 'express';
import { crops, farms, plans, users } from '../database/repositories/store.js';
import { signToken, requireAuth } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimit.js';
import { validateNewPassword } from '../utils/passwordPolicy.js';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { deliverSignupOtp } from '../services/otpDelivery.js';

const router = Router();
const loginRateLimit = createRateLimiter({ name: 'auth-login', windowMs: 15 * 60 * 1000, limit: 10 });
const registerRateLimit = createRateLimiter({ name: 'auth-register', windowMs: 60 * 60 * 1000, limit: 5 });
const passwordChangeRateLimit = createRateLimiter({
  name: 'auth-password-change',
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `user:${req.userId || req.ip || 'unknown'}`,
});
const passwordResetRequestRateLimit = createRateLimiter({ name: 'auth-password-reset-request', windowMs: 15 * 60 * 1000, limit: 5 });
const passwordResetConfirmRateLimit = createRateLimiter({ name: 'auth-password-reset-confirm', windowMs: 15 * 60 * 1000, limit: 10 });
const accountDeleteRateLimit = createRateLimiter({
  name: 'auth-account-delete',
  windowMs: 60 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => `user:${req.userId || req.ip || 'unknown'}`,
});
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const otpVerifyRateLimit = createRateLimiter({ name: 'auth-otp-verify', windowMs: 15 * 60 * 1000, limit: 10 });
const hashOtp = (contactType, contact, code) => createHmac('sha256', process.env.JWT_SECRET || 'development-only-otp-pepper')
  .update(`${contactType}:${contact}:${code}`).digest('hex');
const isValidEmail = (value) => {
  if (typeof value !== 'string' || value.length > 254 || !EMAIL_PATTERN.test(value)) return false;
  const [local, domain] = value.split('@');
  const labels = domain.split('.');
  return local.length <= 64 && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..')
    && labels.length >= 2 && labels.at(-1).length >= 2
    && labels.every(label => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
};

router.post('/register', registerRateLimit, async (req, res, next) => {
  try {
    const { name, contactType, contact, password } = req.body || {};
    if (typeof name !== 'string' || typeof contactType !== 'string' || typeof contact !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'name, contactType, contact and password are required' });
    }
    const normalizedName = name.trim();
    const normalizedContact = contactType === 'email' ? contact.trim().toLowerCase() : contact.trim();
    if (!normalizedName || normalizedName.length > 80) {
      return res.status(400).json({ error: 'Name must contain 1 to 80 characters' });
    }
    if (contactType === 'email' && !isValidEmail(normalizedContact)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (contactType === 'phone' && !PHONE_PATTERN.test(normalizedContact)) return res.status(400).json({ error: 'Enter a phone number with country code, e.g. +919876543210' });
    if (!['email', 'phone'].includes(contactType)) return res.status(400).json({ error: 'Choose email or phone signup' });
    const passwordIssue = validateNewPassword(password);
    if (passwordIssue) return res.status(400).json({ error: passwordIssue });
    const existing = contactType === 'email' ? await users.findByEmail(normalizedContact) : await users.findByPhone(normalizedContact);
    if (existing) return res.status(409).json({ error: `This ${contactType} is already registered` });
    const otp = String(randomInt(100000, 1000000));
    const passwordHash = await bcrypt.hash(password, 10);
    await users.createPendingSignup({ contactType, contact: normalizedContact, name: normalizedName, passwordHash, otpHash: hashOtp(contactType, normalizedContact, otp), attempts: 0 });
    try {
      await deliverSignupOtp({ contactType, contact: normalizedContact, code: otp });
    } catch (deliveryError) {
      await users.deletePendingSignup(contactType, normalizedContact);
      console.error('[auth] Signup OTP delivery failed:', deliveryError.message);
      return res.status(503).json({ error: 'Verification code could not be sent. Check the configured email/SMS provider and try again.' });
    }
    res.status(202).json({ pending: true, contactType, message: `Verification code sent to your ${contactType}. It expires in 10 minutes.` });
  } catch (e) { next(e); }
});

router.post('/verify-otp', otpVerifyRateLimit, async (req, res, next) => {
  try {
    const { contactType, contact, code } = req.body || {};
    if (!['email', 'phone'].includes(contactType) || typeof contact !== 'string' || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the contact used for signup and its 6-digit verification code' });
    }
    const normalizedContact = contactType === 'email' ? contact.trim().toLowerCase() : contact.trim();
    const pending = await users.findPendingSignup(contactType, normalizedContact);
    if (!pending) return res.status(400).json({ error: 'Verification code expired or signup was not found. Start signup again.' });
    if (pending.attempts >= 5) {
      await users.deletePendingSignup(contactType, normalizedContact);
      return res.status(429).json({ error: 'Too many incorrect codes. Start signup again.' });
    }
    const expected = Buffer.from(pending.otpHash, 'hex');
    const actual = Buffer.from(hashOtp(contactType, normalizedContact, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      await users.incrementPendingSignupAttempts(contactType, normalizedContact);
      return res.status(400).json({ error: 'That verification code is incorrect.' });
    }
    const consumed = await users.consumePendingSignup(contactType, normalizedContact, pending.otpHash);
    if (!consumed) return res.status(400).json({ error: 'Verification code is expired or has already been used. Start signup again.' });
    let user;
    try {
      user = await users.createVerified({ name: consumed.name, ...(contactType === 'email' ? { email: normalizedContact } : { phone: normalizedContact }), passwordHash: consumed.passwordHash });
    } catch (error) {
      if (error?.code === 11000) return res.status(409).json({ error: `This ${contactType} is already registered` });
      throw error;
    }
    res.status(201).json({ token: signToken(user), user: users.public(user) });
  } catch (e) { next(e); }
});

router.post('/forgot-password', passwordResetRequestRateLimit, async (req, res, next) => {
  try {
    const { contactType, contact } = req.body || {};
    if (!['email', 'phone'].includes(contactType) || typeof contact !== 'string') {
      return res.status(400).json({ error: 'Choose email or phone and enter the account contact.' });
    }
    const normalizedContact = contactType === 'email' ? contact.trim().toLowerCase() : contact.trim();
    if ((contactType === 'email' && !isValidEmail(normalizedContact))
      || (contactType === 'phone' && !PHONE_PATTERN.test(normalizedContact))) {
      return res.status(400).json({ error: 'Enter a valid email address or phone with country code.' });
    }
    const user = contactType === 'email'
      ? await users.findByEmail(normalizedContact)
      : await users.findByPhone(normalizedContact);
    if (user) {
      const otp = String(randomInt(100000, 1000000));
      await users.createPendingPasswordReset({
        contactType,
        contact: normalizedContact,
        userId: String(user._id || user.id),
        otpHash: hashOtp(contactType, normalizedContact, otp),
        attempts: 0,
      });
      try {
        await deliverSignupOtp({ contactType, contact: normalizedContact, code: otp });
      } catch (deliveryError) {
        await users.deletePendingPasswordReset(contactType, normalizedContact);
        console.error('[auth] Password reset delivery failed:', deliveryError.message);
      }
    }
    // Same status and message for known and unknown accounts to prevent enumeration.
    return res.status(202).json({ message: 'If an account matches this contact, a reset code has been sent. It expires in 10 minutes.' });
  } catch (error) { next(error); }
});

router.post('/reset-password', passwordResetConfirmRateLimit, async (req, res, next) => {
  try {
    const { contactType, contact, code, newPassword } = req.body || {};
    if (!['email', 'phone'].includes(contactType) || typeof contact !== 'string'
      || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Enter the account contact and its 6-digit reset code.' });
    }
    const passwordIssue = validateNewPassword(newPassword);
    if (passwordIssue) return res.status(400).json({ error: passwordIssue });
    const normalizedContact = contactType === 'email' ? contact.trim().toLowerCase() : contact.trim();
    const pending = await users.findPendingPasswordReset(contactType, normalizedContact);
    if (!pending) return res.status(400).json({ error: 'Reset code expired or was not found. Request a new code.' });
    if (pending.attempts >= 5) {
      await users.deletePendingPasswordReset(contactType, normalizedContact);
      return res.status(429).json({ error: 'Too many incorrect codes. Request a new reset code.' });
    }
    const expected = Buffer.from(pending.otpHash, 'hex');
    const actual = Buffer.from(hashOtp(contactType, normalizedContact, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const updated = await users.incrementPendingPasswordResetAttempts(contactType, normalizedContact);
      if (!updated || updated.attempts >= 5) {
        await users.deletePendingPasswordReset(contactType, normalizedContact);
        return res.status(429).json({ error: 'Too many incorrect codes. Request a new reset code.' });
      }
      return res.status(400).json({ error: 'That reset code is incorrect.' });
    }
    const consumed = await users.consumePendingPasswordReset(contactType, normalizedContact, pending.otpHash);
    if (!consumed) return res.status(400).json({ error: 'Reset code expired or was already used. Request a new code.' });
    const updatedUser = await users.updatePassword(consumed.userId, newPassword);
    if (!updatedUser) return res.status(400).json({ error: 'Account was not found. Request a new reset code.' });
    return res.json({ ok: true, message: 'Password reset. Sign in with your new password.' });
  } catch (error) { next(error); }
});

router.post('/login', loginRateLimit, async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body || {};
    const suppliedIdentifier = identifier ?? email;
    if (typeof suppliedIdentifier !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'email or phone and password must be strings' });
    }
    const rawIdentifier = suppliedIdentifier.trim();
    const normalizedIdentifier = rawIdentifier.includes('@') ? rawIdentifier.toLowerCase() : rawIdentifier;
    const validIdentifier = normalizedIdentifier.includes('@')
      ? isValidEmail(normalizedIdentifier)
      : PHONE_PATTERN.test(normalizedIdentifier);
    if (!validIdentifier || password.length > 128) {
      return res.status(400).json({ error: 'Enter a valid email or phone with country code and password' });
    }
    const user = await users.findByIdentifier(normalizedIdentifier);
    if (!user || !(await users.verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid email/phone or password' });
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
    const { password, confirmEmail, confirmContact } = req.body || {};
    if (typeof password !== 'string' || !password || password.length > 128) {
      return res.status(400).json({ error: 'Enter your password to confirm account deletion.' });
    }
    if (!(await users.verifyPassword(req.user, password))) {
      return res.status(400).json({ error: 'Password is incorrect.' });
    }
    const confirmation = typeof confirmContact === 'string' ? confirmContact.trim() : typeof confirmEmail === 'string' ? confirmEmail.trim() : '';
    const expectedContact = req.user.email || req.user.phone || '';
    if (confirmation.toLowerCase() !== expectedContact.toLowerCase()) {
      return res.status(400).json({ error: `Type your account ${req.user.email ? 'email' : 'phone number'} exactly to confirm deletion.` });
    }
    const deleted = await users.deleteAccount(req.userId);
    if (!deleted?.account) return res.status(404).json({ error: 'Account not found.' });
    res.json({ ok: true, deleted: { farms: deleted.farms, crops: deleted.crops, cropPlans: deleted.plans } });
  } catch (error) { next(error); }
});

export default router;
