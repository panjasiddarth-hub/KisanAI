// User persistence model.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: undefined },
    passwordHash: { type: String, required: true },
    tokenVersion: { type: Number, default: 0 },
    role: { type: String, default: 'farmer' },
    phone: { type: String, default: undefined },
    location: { type: String, default: '' },
  },
  { timestamps: true }
);

// Sparse unique indexes allow farmers to register with either contact method.
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ phone: 1 }, { unique: true, sparse: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
