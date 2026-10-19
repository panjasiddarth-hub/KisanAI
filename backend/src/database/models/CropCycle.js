// One crop grown on one plot, from plan to harvest: crop, season, dates, status and observations.
// Exactly one open (planned/active) cycle per plot — enforced by a partial unique index, so two
// simultaneous requests can never both open a cycle on the same plot.
import mongoose from 'mongoose';

export const CYCLE_STATUSES = ['planned', 'active', 'harvested', 'abandoned'];
export const OPEN_STATUSES = ['planned', 'active'];
export const SEASONS = ['kharif', 'rabi', 'zaid', 'perennial'];
export const OBSERVATION_TYPES = ['note', 'growth_stage', 'pest', 'disease', 'weather', 'irrigation', 'fertilizer', 'harvest', 'other'];
export const HARVEST_UNITS = ['kg', 'quintal', 'tonne'];

const observationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    date: { type: String, required: true },              // YYYY-MM-DD
    type: { type: String, enum: OBSERVATION_TYPES, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    value: { type: Number },
    unit: { type: String, maxlength: 20 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const cropCycleSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    farmId: { type: String, required: true, index: true },
    plotId: { type: String, required: true },
    crop: { type: String, required: true, maxlength: 60 },
    cropKey: { type: String, default: null },             // knowledge-base crop name; null if not in the KB
    variety: { type: String, default: '', maxlength: 60 },
    season: { type: String, enum: SEASONS, required: true },
    status: { type: String, enum: CYCLE_STATUSES, required: true },
    isOpen: { type: Boolean, required: true },            // true while planned/active
    plannedSowingDate: { type: String, default: null },
    sowingDate: { type: String, default: null },
    harvest: {
      date: { type: String },
      quantity: { type: Number, min: 0 },
      unit: { type: String, enum: [...HARVEST_UNITS, null] },
    },
    closedAt: { type: Date, default: null },
    source: { type: String, enum: ['manual', 'recommendation'], default: 'manual' },
    recommendationId: { type: String, default: null },
    notes: { type: String, default: '', maxlength: 1000 },
    plotRevisionAtStart: { type: Number, default: null },  // plot inputs the cycle was planned with
    revision: { type: Number, default: 1 },                // bumped when crop, season or dates change (staleness)
    observations: { type: [observationSchema], default: [] },
  },
  { timestamps: true }
);

cropCycleSchema.index({ userId: 1, plotId: 1, _id: -1 });
cropCycleSchema.index({ userId: 1, isOpen: 1 });
cropCycleSchema.index({ plotId: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });

export const CropCycle = mongoose.models.CropCycle || mongoose.model('CropCycle', cropCycleSchema);
