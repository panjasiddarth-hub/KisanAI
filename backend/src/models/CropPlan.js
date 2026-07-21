// src/models/CropPlan.js — a farmer's AI-generated crop season calendar
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },        // YYYY-MM-DD
    title: { type: String, required: true },
    type: { type: String, default: 'task' },        // prep|sowing|irrigation|fertilizer|pest|weeding|harvest|task
    notes: { type: String, default: '' },
    agent: { type: String, default: 'calendar-agent' },
    done: { type: Boolean, default: false },
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
  },
  { timestamps: true }
);

export const CropPlan = mongoose.models.CropPlan || mongoose.model('CropPlan', cropPlanSchema);
