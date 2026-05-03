/**
 * pythonBridge.js — Spawns Python inference scripts and captures JSON output.
 * The ML pipeline (sklearn/XGB/SHAP) runs in Python child processes;
 * results are returned as parsed JSON to the Express server.
 */
const { spawn } = require("child_process");
const path = require("path");

// PYTHON_PATH env var overrides; else auto-detect: python3 on Linux/Mac, python on Windows
const PYTHON =
  process.env.PYTHON_PATH ||
  (process.platform === "win32" ? "python" : "python3");

const SRC_DIR = path.join(__dirname, "src");

/**
 * Run a Python script and parse its stdout as JSON.
 * @param {string} script - Filename inside /src (e.g. "infer.py")
 * @param {string[]} args  - CLI args passed to the script
 * @returns {Promise<any>} Parsed JSON output
 */
const runPythonScript = (script, args = []) =>
  new Promise((resolve, reject) => {
    const scriptPath = path.join(SRC_DIR, script);
    const proc = spawn(PYTHON, [scriptPath, ...args], {
      cwd: path.join(__dirname),
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python script failed (exit ${code}): ${stderr.slice(-500)}`));
      }
      // Find the last JSON object/array in stdout (logging may precede it)
      const jsonMatch = stdout.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
      if (!jsonMatch) {
        return reject(new Error(`No JSON in Python output. stdout: ${stdout.slice(-300)}`));
      }
      try {
        resolve(JSON.parse(jsonMatch[1]));
      } catch (e) {
        reject(new Error(`JSON parse error: ${e.message}`));
      }
    });
  });

module.exports = { runPythonScript };
