import mongoose from 'mongoose';

const pendingPasswordResetSchema = new mongoose.Schema({
  contactKey: { type: String, required: true, unique: true },
  contactType: { type: String, enum: ['email', 'phone'], required: true },
  contact: { type: String, required: true },
  userId: { type: String, required: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 600 },
}, { timestamps: true });

export const PendingPasswordReset = mongoose.models.PendingPasswordReset
  || mongoose.model('PendingPasswordReset', pendingPasswordResetSchema);
