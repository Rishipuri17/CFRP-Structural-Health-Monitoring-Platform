/**
 * routes/train.js — Training pipeline trigger with SSE progress streaming
 */
const router = require("express").Router();
const { spawn } = require("child_process");
const path = require("path");

// PYTHON_PATH env var overrides; else auto-detect: python3 on Linux/Mac, python on Windows
const PYTHON =
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const BACKEND = path.join(__dirname, "..");

const runStep = (res, label, script, args = []) =>
  new Promise((resolve, reject) => {
    res.write(`data: ${JSON.stringify({ step: label, status: "running" })}\n\n`);
    const proc = spawn(PYTHON, [path.join(BACKEND, "src", script), ...args], { cwd: BACKEND });
    proc.stderr.on("data", (d) => {
      const lines = d.toString().split("\n").filter(Boolean);
      lines.forEach((line) =>
        res.write(`data: ${JSON.stringify({ step: label, log: line })}\n\n`)
      );
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        res.write(`data: ${JSON.stringify({ step: label, status: "error", code })}\n\n`);
        reject(new Error(`${script} exited with code ${code}`));
      } else {
        res.write(`data: ${JSON.stringify({ step: label, status: "done" })}\n\n`);
        resolve();
      }
    });
  });

// POST /api/train — streams SSE progress
router.post("/", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  try {
    await runStep(res, "simulate",           "simulate.py");
    await runStep(res, "train_classifier",   "train_classifier.py");
    await runStep(res, "train_regressor",    "train_regressor.py");
    res.write(`data: ${JSON.stringify({ status: "complete", message: "All models trained successfully." })}\n\n`);
  } catch (err) {
    res.write(`data: ${JSON.stringify({ status: "failed", error: err.message })}\n\n`);
  } finally {
    res.end();
  }
});

module.exports = router;
