// Farm-specific crop recommendation runs: inputs used (with provenance), the shortlist,
// exclusions, missing information and the farmer's selection. Kept as history per farm.
import mongoose from 'mongoose';

const { Mixed } = mongoose.Schema.Types;

const recommendationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    farmId: { type: String, required: true, index: true },
    plotId: { type: String, default: null },        // plot recommendations (Milestone 4); legacy runs are farm-level
    plotRevision: { type: Number, default: null },  // plot inputs revision the run used (staleness)
    cropCycleId: { type: String, default: null },   // crop cycle created from this run, once confirmed
    status: { type: String, enum: ['ok', 'partial', 'insufficient_data'], required: true },
    engine: { type: String, enum: ['ml', 'rule-engine', 'none'], required: true },
    plannedSowingDate: { type: String, required: true },   // YYYY-MM-DD
    season: { type: String, default: '' },
    inputs: { type: Mixed, default: {} },
    model: { type: Mixed, default: null },
    shortlist: { type: [Mixed], default: [] },
    excluded: { type: [Mixed], default: [] },
    missing: { type: [Mixed], default: [] },
    limitations: { type: [String], default: [] },
    selectedCrop: { type: String, default: null },
    selectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recommendationSchema.index({ userId: 1, plotId: 1, createdAt: -1 });

export const Recommendation =
  mongoose.models.Recommendation || mongoose.model('Recommendation', recommendationSchema);
