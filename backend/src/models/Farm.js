// src/models/Farm.js
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
    lastUpdated: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);
