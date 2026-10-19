// A farmer's AI-generated crop season calendar persistence model.
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },        // YYYY-MM-DD
    title: { type: String, required: true },
    type: { type: String, default: 'task' },        // prep|sowing|irrigation|fertilizer|pest|weeding|harvest|task
    notes: { type: String, default: '' },
    agent: { type: String, default: 'calendar-agent' },
    done: { type: Boolean, default: false },
    id: { type: String },       // stable event id (plot calendars; legacy events have none)
    key: { type: String },      // template key (type|title|n): keeps id + done across regeneration
  },
  { _id: false }
);

const cropPlanSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    crop: { type: String, required: true },
    areaAcres: { type: Number, default: 1 },
    season: { type: String, default: '' },
    farmName: { type: String, default: 'My Farm' },
    sowingDate: { type: String, required: true },
    harvestWindow: { type: String, default: '' },
    events: [eventSchema],
    farmId: { type: String, index: true },        // set when the plan was generated for a saved farm
    recommendationId: { type: String },           // recommendation run the crop was selected from
    plotId: { type: String, index: true },        // plot calendars (Milestone 4); legacy plans have none
    cropCycleId: { type: String },                // one calendar per crop cycle
    plotName: { type: String },
    basis: {                                      // inputs the calendar was generated from (staleness)
      crop: { type: String }, sowingDate: { type: String }, cycleRevision: { type: Number }, generatedAt: { type: Date },
    },
  },
  { timestamps: true }
);

// At most one plan per farm + crop + sowing date: page refreshes / double submits can't create duplicates.
// Partial filter → plans without a farm (the original free-form calendar) are unaffected.
// Uniqueness (Milestone 4, applied by scripts/migrations/2026-10-cropplan-plot-index.mjs):
// - farm + plot + crop + sowing date: legacy plans have no plotId (null in the index), so their old
//   per-farm rule is unchanged, while two plots of one farm may grow the same crop on the same date;
// - one calendar per crop cycle.
// The previous index { userId, farmId, crop, sowingDate } is dropped by the migration script.
cropPlanSchema.index(
  { userId: 1, farmId: 1, plotId: 1, crop: 1, sowingDate: 1 },
  { unique: true, partialFilterExpression: { farmId: { $type: 'string' } }, name: 'user_farm_plot_crop_sowing_unique' }
);
cropPlanSchema.index({ cropCycleId: 1 }, { unique: true, partialFilterExpression: { cropCycleId: { $type: 'string' } }, name: 'cropCycle_unique' });

export const CropPlan = mongoose.models.CropPlan || mongoose.model('CropPlan', cropPlanSchema);
