// Farm persistence model.
import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    area: { type: Number, required: true },
    areaUnit: { type: String, default: 'acres' },
    soilType: { type: String, default: '' },
    waterSource: { type: String, default: '' },
    crops: [{ type: String }],
    images: [{ type: String }],
    healthScore: { type: Number, default: 75 },
    lastUpdated: { type: String, default: '' },
    // Farm location — only used by farm features once the farmer has confirmed it (confirmedAt set)
    coordinates: {
      lat: { type: Number, min: -90, max: 90 },
      lon: { type: Number, min: -180, max: 180 },
      source: { type: String, enum: ['device', 'geocoded', 'manual'] },
      label: { type: String },
      confirmedAt: { type: Date },
    },
    // Latest soil test (e.g. Soil Health Card) — crop-model inputs, never defaulted
    soilTest: {
      N: { type: Number, min: 0 },
      P: { type: Number, min: 0 },
      K: { type: Number, min: 0 },
      ph: { type: Number, min: 0, max: 14 },
      // Remaining Soil Health Card parameters (optional; the ML soil-rating model needs all 12)
      ec: { type: Number, min: 0 },   // dS/m
      oc: { type: Number, min: 0 },   // %
      s: { type: Number, min: 0 },    // ppm
      zn: { type: Number, min: 0 },
      b: { type: Number, min: 0 },
      fe: { type: Number, min: 0 },
      cu: { type: Number, min: 0 },
      mn: { type: Number, min: 0 },
      testedOn: { type: String },
    },
    // Crop the farmer picked from a farm recommendation (set by the select endpoint only)
    selectedCrop: {
      crop: { type: String },
      displayName: { type: String },
      calendarCrop: { type: String },
      recommendationId: { type: String },
      sowingDate: { type: String },
      selectedAt: { type: Date },
    },
  },
  { timestamps: true }
);

export const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);
