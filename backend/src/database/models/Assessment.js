// One run of a plot-level advisory agent (fertilizer, irrigation, market) for a crop cycle.
// Kept as history: the inputs it used, the plot / cycle versions and data timestamps it was based
// on, where each part came from, and the result. Advice is never recomputed silently — the farmer
// asks for a reassessment, which adds a new record.
import mongoose from 'mongoose';
const { Mixed } = mongoose.Schema.Types;

export const ASSESSMENT_AGENTS = ['fertilizer', 'irrigation', 'market'];

const assessmentSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    farmId: { type: String, required: true },
    plotId: { type: String, required: true },
    cropCycleId: { type: String, required: true },
    agent: { type: String, enum: ASSESSMENT_AGENTS, required: true },
    status: { type: String, enum: ['ok', 'partial', 'insufficient_data', 'error'], required: true },
    sources: { type: [Mixed], default: [] },          // [{ kind: trained_model|external_api|calculation|sample_data, name, detail }]
    inputs: { type: Mixed, default: {} },             // snapshot of the inputs used
    plotRevision: { type: Number, required: true },
    cycleRevision: { type: Number, required: true },
    dataTimestamps: { type: Mixed, default: {} },     // e.g. { weatherFetchedAt }
    result: { type: Mixed, default: null },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

assessmentSchema.index({ userId: 1, plotId: 1, agent: 1, createdAt: -1 });
assessmentSchema.index({ farmId: 1 });

export const Assessment = mongoose.models.Assessment || mongoose.model('Assessment', assessmentSchema);
