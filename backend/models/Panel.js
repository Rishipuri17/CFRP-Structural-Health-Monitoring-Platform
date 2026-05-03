/**
 * models/Panel.js — Mongoose schema for CFRP panel metadata
 */
const mongoose = require("mongoose");

const PanelSchema = new mongoose.Schema(
  {
    panelId:       { type: String, required: true, unique: true, index: true },
    material:      { type: String, default: "Unknown" },
    layup:         { type: String, default: "Unknown" },
    maxCycles:     { type: Number, default: 18000 },
    minCycle:      { type: Number, default: 0 },
    cycleCount:    { type: Number, default: 0 },
    sensorCount:   { type: Number, default: 16 },
    availableCycles: [Number],
    source:        { type: String, default: "synthetic" }, // "nasa" or "synthetic"
    notes:         { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Panel", PanelSchema);
