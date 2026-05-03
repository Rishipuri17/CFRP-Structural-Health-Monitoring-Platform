/**
 * routes/panels.js — Panel listing and metadata endpoints
 */
const router = require("express").Router();
const Panel  = require("../models/Panel");
const { runPythonScript } = require("../pythonBridge");

// GET /api/panels — list all available panel IDs
router.get("/", async (_req, res) => {
  let panels = [];
  try {
    // Try MongoDB cache first
    panels = await Panel.find({}, { panelId: 1, material: 1, layup: 1, maxCycles: 1, cycleCount: 1, sensorCount: 1 }).lean();
  } catch (_) { /* MongoDB unavailable — fall through */ }

  if (panels.length === 0) {
    // Fall back to Python (reads disk)
    const ids = await runPythonScript("infer.py", ["panels"]);
    for (const id of ids) {
      const meta = await runPythonScript("infer.py", ["metadata", id]);
      try {
        await Panel.findOneAndUpdate(
          { panelId: id },
          {
            panelId:         id,
            material:        meta.material || "Unknown",
            layup:           meta.layup    || "Unknown",
            maxCycles:       meta.max_cycles   || 18000,
            minCycle:        meta.min_cycle    || 0,
            cycleCount:      meta.cycle_count  || 0,
            sensorCount:     meta.sensor_count || 16,
            availableCycles: meta.available_cycles || [],
          },
          { upsert: true, new: true }
        );
      } catch (_) { /* MongoDB unavailable — skip caching */ }
      panels.push({ panelId: id, ...meta });
    }
    if (panels.length === 0) {
      try { panels = await Panel.find({}).lean(); } catch (_) {}
    }
  }
  res.json(panels);
});

// GET /api/panels/:id/metadata
router.get("/:id/metadata", async (req, res) => {
  const { id } = req.params;
  let panel = await Panel.findOne({ panelId: id }).lean();
  if (!panel) {
    const meta = await runPythonScript("infer.py", ["metadata", id]);
    if (meta.error) return res.status(404).json(meta);
    panel = await Panel.findOneAndUpdate(
      { panelId: id },
      {
        panelId:         id,
        material:        meta.material        || "Unknown",
        layup:           meta.layup           || "Unknown",
        maxCycles:       meta.max_cycles      || 18000,
        minCycle:        meta.min_cycle       || 0,
        cycleCount:      meta.cycle_count     || 0,
        sensorCount:     meta.sensor_count    || 16,
        availableCycles: meta.available_cycles || [],
      },
      { upsert: true, new: true, returnDocument: "after" }
    ).lean();
  }
  res.json(panel);
});

module.exports = router;
