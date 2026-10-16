// Farm persistence model.
import mongoose from 'mongoose';

const farmSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    location: { type: String, required: true },
    farmerName: { type: String, default: '' },
    farmerPhone: { type: String, default: '' },
    village: { type: String, default: '' },
    district: { type: String, default: '' },
    state: { type: String, default: '' },
    area: { type: Number, required: true },
    areaUnit: { type: String, default: 'acres' },
    landOwnership: { type: String, default: '' },
    soilType: { type: String, default: '' },
    soilPH: { type: Number, min: 0, max: 14 },
    soilTestDate: { type: String, default: '' },
    waterSource: { type: String, default: '' },
    waterAvailability: { type: String, default: '' },
    irrigationMethods: [{ type: String }],
    waterQuality: { type: String, default: '' },
    crops: [{ type: String }],
    season: { type: String, default: '' },
    previousCrop: { type: String, default: '' },
    cultivationMethod: { type: String, default: '' },
    images: [{ type: String }],
    healthScore: { type: Number, default: 75 },
    lastUpdated: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Farm = mongoose.models.Farm || mongoose.model('Farm', farmSchema);
