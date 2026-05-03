/**
 * models/Prediction.js — Mongoose schema for storing ML prediction results
 */
const mongoose = require("mongoose");

const PredictionSchema = new mongoose.Schema(
  {
    panelId:   { type: String, required: true, index: true },
    cycle:     { type: Number, required: true },
    type:      { type: String, enum: ["classification", "rul"], required: true },

    // Classification fields
    label:       { type: String },
    labelIndex:  { type: Number },
    confidence:  { type: Number },
    probabilities: [Number],

    // RUL fields
    rul:         { type: Number },
    rulNorm:     { type: Number },
    degradationRate: { type: Number },

    // Common
    modelUsed:   { type: String },
    computedAt:  { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PredictionSchema.index({ panelId: 1, cycle: 1, type: 1 });

module.exports = mongoose.model("Prediction", PredictionSchema);
