// src/models/Crop.js
import mongoose from 'mongoose';

const cropSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    farmId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    variety: { type: String, default: '' },
    sowingDate: { type: String, default: '' },
    expectedHarvest: { type: String, default: '' },
    stage: { type: String, default: 'Sowing' },
    progress: { type: Number, default: 5 },
    area: { type: Number, required: true },
    yield: { type: Number, default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Crop = mongoose.models.Crop || mongoose.model('Crop', cropSchema);
