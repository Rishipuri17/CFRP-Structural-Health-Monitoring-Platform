/**
 * routes/ml.js — ML inference endpoints (classify, RUL, SHAP, performance)
 */
const router     = require("express").Router();
const Prediction = require("../models/Prediction");
const { runPythonScript } = require("../pythonBridge");

// POST /api/ml/:panelId/classify?cycle=N
router.post("/:panelId/classify", async (req, res) => {
  const { panelId } = req.params;
  const cycle = parseInt(req.query.cycle || req.body.cycle || "0", 10);

  const data = await runPythonScript("infer.py", ["classify", panelId, String(cycle)]);
  if (data.error) return res.status(data.status || 500).json(data);

  // Persist to MongoDB (non-fatal)
  try {
    await Prediction.findOneAndUpdate(
      { panelId, cycle, type: "classification" },
      {
        panelId,
        cycle,
        type:          "classification",
        label:         data.label,
        labelIndex:    data.label_index,
        confidence:    data.confidence,
        probabilities: Object.values(data.probabilities),
        computedAt:    new Date(),
      },
      { upsert: true }
    );
  } catch (_) { /* MongoDB unavailable */ }

  res.json(data);
});

// POST /api/ml/:panelId/rul?cycle=N
router.post("/:panelId/rul", async (req, res) => {
  const { panelId } = req.params;
  const cycle = parseInt(req.query.cycle || req.body.cycle || "0", 10);

  const data = await runPythonScript("infer.py", ["rul", panelId, String(cycle)]);
  if (data.error) return res.status(data.status || 500).json(data);

  // Persist (non-fatal)
  try {
    await Prediction.findOneAndUpdate(
      { panelId, cycle, type: "rul" },
      {
        panelId,
        cycle,
        type:            "rul",
        rul:             data.rul,
        rulNorm:         data.rul_normalized,
        degradationRate: data.degradation_rate,
        computedAt:      new Date(),
      },
      { upsert: true }
    );
  } catch (_) { /* MongoDB unavailable */ }

  res.json(data);
});

// GET /api/ml/:panelId/shap?cycle=N
router.get("/:panelId/shap", async (req, res) => {
  const { panelId } = req.params;
  const cycle = parseInt(req.query.cycle || "0", 10);
  const data  = await runPythonScript("infer.py", ["shap", panelId, String(cycle)]);
  if (data.error) return res.status(data.status || 500).json(data);
  res.json(data);
});

// GET /api/ml/:panelId/feature_importance
router.get("/:panelId/feature_importance", async (_req, res) => {
  const data = await runPythonScript("infer.py", ["importance"]);
  if (data.error) return res.status(data.status || 500).json(data);
  res.json(data);
});

// GET /api/ml/performance
router.get("/performance", async (_req, res) => {
  const data = await runPythonScript("infer.py", ["performance"]);
  if (data.error) return res.status(data.status || 500).json(data);
  res.json(data);
});

// GET /api/ml/:panelId/history — prediction history from MongoDB
router.get("/:panelId/history", async (req, res) => {
  const { panelId } = req.params;
  const { type }    = req.query;
  const query       = { panelId };
  if (type) query.type = type;
  try {
    const records = await Prediction.find(query).sort({ cycle: 1 }).lean();
    res.json(records);
  } catch (_) {
    res.json([]); // MongoDB unavailable — return empty history
  }
});

module.exports = router;

