// Per-farm lock document. Writes that can increase a farm's allocated area (create / enlarge /
// restore a plot, shrink the farm) increment it inside their transaction, so two concurrent writers
// for the same farm conflict and are retried one after the other — preventing write skew (both
// reading the old plots and together exceeding the farm area). It holds no farm data.
import mongoose from 'mongoose';

const farmLockSchema = new mongoose.Schema(
  {
    _id: { type: String },          // farm id
    userId: { type: String, required: true },
    v: { type: Number, default: 0 },
    at: { type: Date },
  },
  { versionKey: false }
);

export const FarmLock = mongoose.models.FarmLock || mongoose.model('FarmLock', farmLockSchema);
