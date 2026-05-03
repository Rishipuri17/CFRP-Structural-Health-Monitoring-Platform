/**
 * server.js — CFRP SHM Platform Express API
 * MERN stack: MongoDB + Express + React (frontend) + Node.js
 *
 * All ML inference is delegated to Python child processes via pythonBridge.js.
 * MongoDB stores panel metadata and prediction history for fast retrieval.
 */
require("dotenv").config();
require("express-async-errors");

const express  = require("express");
const cors     = require("cors");
const morgan   = require("morgan");
const { connect } = require("./db");

const panelRoutes  = require("./routes/panels");
const signalRoutes = require("./routes/signals");
const mlRoutes     = require("./routes/ml");
const trainRoutes  = require("./routes/train");

const app  = express();
const PORT = process.env.PORT || 5001;
const isProd = process.env.NODE_ENV === "production";

// ── CORS ────────────────────────────────────────────────────────────────────
// CORS_ORIGIN is set to the Vercel frontend URL in production.
// Accepts a comma-separated list, e.g. "https://cfrp-shm.vercel.app,https://www.cfrp-shm.com"
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:4173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(isProd ? "combined" : "dev"));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/panels",  panelRoutes);
app.use("/api/signal",  signalRoutes);
app.use("/api/ml",      mlRoutes);
app.use("/api/train",   trainRoutes);

// Health check
app.get("/api/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message, detail: err.stack?.split("\n")[1] || "" });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
(async () => {
  await connect();
  app.listen(PORT, () => {
    console.log(`\n🚀 CFRP SHM API running → http://localhost:${PORT}`);
    console.log(`   MongoDB connected, ML bridge ready.\n`);
  });
})();
