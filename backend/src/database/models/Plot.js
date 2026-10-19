// A plot (field) inside a farm: its own area, soil profile, water access and crop history.
// Soil fields use the same names and units as Farm so the farm-linked agents can read either.
import mongoose from 'mongoose';
import { AREA_UNITS } from '../../services/units.js';

const soilTestSchema = new mongoose.Schema(
  {
    N: { type: Number, min: 0 }, P: { type: Number, min: 0 }, K: { type: Number, min: 0 },   // kg/ha
    ph: { type: Number, min: 0, max: 14 },
    ec: { type: Number, min: 0 },   // dS/m
    oc: { type: Number, min: 0 },   // %
    s: { type: Number, min: 0 }, zn: { type: Number, min: 0 }, b: { type: Number, min: 0 },   // ppm
    fe: { type: Number, min: 0 }, cu: { type: Number, min: 0 }, mn: { type: Number, min: 0 },
    testedOn: { type: String },
  },
  { _id: false }
);

const previousCropSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },   // stable id, kept across edits
    crop: { type: String, required: true, maxlength: 60 },
    season: { type: String, enum: ['kharif', 'rabi', 'zaid', 'perennial', ''], default: '' },
    year: { type: Number, min: 1990, max: 2100 },
    notes: { type: String, default: '', maxlength: 200 },
  },
  { _id: false }
);

const plotSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    farmId: { type: String, required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    nameKey: { type: String, required: true },           // lower-cased name: unique among a farm's active plots
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    archivedAt: { type: Date, default: null },
    area: { type: Number, required: true, min: 0 },
    areaUnit: { type: String, required: true, enum: AREA_UNITS },
    areaAcres: { type: Number, default: null },           // null when the unit can't be converted (bigha)
    soilType: { type: String, default: '' },
    soilTest: { type: soilTestSchema, default: null },
    waterAccess: {
      source: { type: String, default: '' },
      method: { type: String, default: '' },
    },
    previousCrops: { type: [previousCropSchema], default: [] },
    // Bumped whenever an agronomic input (area, soil, water, crop history) changes, so results
    // computed from older inputs can be recognised as stale and reassessed explicitly.
    inputsRevision: { type: Number, default: 1 },
    inputsUpdatedAt: { type: Date, default: Date.now },
    copiedFromFarm: {
      at: { type: Date },
      fields: [{ type: String }],
    },
  },
  { timestamps: true }
);

plotSchema.index({ userId: 1, farmId: 1, status: 1 });
plotSchema.index({ farmId: 1, nameKey: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

export const Plot = mongoose.models.Plot || mongoose.model('Plot', plotSchema);
