import mongoose from 'mongoose';

const pendingSignupSchema = new mongoose.Schema({
  contactKey: { type: String, required: true, unique: true },
  contactType: { type: String, enum: ['email', 'phone'], required: true },
  contact: { type: String, required: true },
  name: { type: String, required: true },
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 600 },
}, { timestamps: true });

export const PendingSignup = mongoose.models.PendingSignup || mongoose.model('PendingSignup', pendingSignupSchema);
