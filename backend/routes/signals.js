/**
 * routes/signals.js — Raw waveform signal endpoints
 */
const router = require("express").Router();
const { runPythonScript } = require("../pythonBridge");

// GET /api/signal/:panelId/all?cycle=N — all 16 channels (must be declared before /:panelId)
router.get("/:panelId/all", async (req, res) => {
  const { panelId } = req.params;
  const cycle = parseInt(req.query.cycle || "0", 10);
  const data  = await runPythonScript("infer.py", ["signals_all", panelId, String(cycle)]);
  if (data.error) return res.status(data.status || 500).json(data);
  res.json(data);
});

// GET /api/signal/:panelId?cycle=N&channel=0-15
router.get("/:panelId", async (req, res) => {
  const { panelId }        = req.params;
  const cycle   = parseInt(req.query.cycle   || "0", 10);
  const channel = parseInt(req.query.channel || "0", 10);
  const data = await runPythonScript("infer.py", ["signal", panelId, String(cycle), String(channel)]);
  if (data.error) return res.status(data.status || 500).json(data);
  res.json(data);
});

module.exports = router;
