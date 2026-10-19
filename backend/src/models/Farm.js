// Farm persistence model.
import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, default: 'Untitled farm' },
    location: { type: String, default: '' },
    area: { type: Number, default: 0 },
    areaUnit: { type: String, default: 'acres' },
    soilType: { type: String, default: '' },
    waterSource: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lon: { type: Number, min: -180, max: 180 },
      source: { type: String, enum: ['device', 'geocoded', 'manual'] },
      label: { type: String },
      confirmedAt: { type: Date },
    },
    soilTest: {
      N: { type: Number, min: 0 },
      P: { type: Number, min: 0 },
      K: { type: Number, min: 0 },
      ph: { type: Number, min: 0, max: 14 },
      ec: { type: Number, min: 0 },
      oc: { type: Number, min: 0 },
      s: { type: Number, min: 0 },
      zn: { type: Number, min: 0 },
      b: { type: Number, min: 0 },
      fe: { type: Number, min: 0 },
      cu: { type: Number, min: 0 },
      mn: { type: Number, min: 0 },
      testedOn: { type: String },
    },
    soilReport: {
      id: { type: String },
      name: { type: String },
      mimeType: { type: String, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
      size: { type: Number, min: 1 },
      uploadedAt: { type: String },
      summary: { type: String, maxlength: 1200 },
      printedAdvice: { type: [String], default: [] },
    },
    crops: [{ type: String }],
    images: [{ type: String }],
    healthScore: { type: Number, default: 75 },
    lastUpdated: { type: String, default: '' },
    isDraft: { type: Boolean, default: false, index: true },
    profile: { type: mongoose.Schema.Types.Mixed, default: {} },
    cropHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
    activities: { type: [mongoose.Schema.Types.Mixed], default: [] },
    recommendationHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true }
);

export const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);
