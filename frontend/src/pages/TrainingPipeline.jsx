/**
 * TrainingPipeline.jsx — ML model training trigger with SSE live log stream.
 * Shows step-by-step progress, live log output, and final performance metrics.
 */
import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerTraining, fetchModelPerformance } from "../api/client.js";

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -12 },
};

const STEPS = [
  { key: "simulate",          label: "Generate Synthetic Data",    desc: "Creates .mat files for 4 CFRP panels × 60 fatigue snapshots" },
  { key: "train_classifier",  label: "Train Damage Classifier",     desc: "RF · XGBoost · GBT · SVC — picks best by weighted F1" },
  { key: "train_regressor",   label: "Train RUL Regressor",         desc: "RF · XGBoost · GBT — picks best by RMSE" },
];

function StepRow({ step, status, logs }) {
  const icon = {
    idle:    <span className="w-5 h-5 rounded-full border border-border flex-shrink-0" />,
    running: (
      <span className="w-5 h-5 rounded-full border-2 border-cyan border-t-transparent animate-spin flex-shrink-0" />
    ),
    done:    (
      <span className="w-5 h-5 rounded-full bg-green/20 border border-green flex items-center justify-center flex-shrink-0 text-green text-[10px]">✓</span>
    ),
    error:   (
      <span className="w-5 h-5 rounded-full bg-red/20 border border-red flex items-center justify-center flex-shrink-0 text-red text-[10px]">✕</span>
    ),
  }[status] || null;

  const borderColor = { running: "border-cyan/40", done: "border-green/30", error: "border-red/30" }[status] || "border-border";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`glass-card p-4 border ${borderColor} transition-colors`}
    >
      <div className="flex items-center gap-3 mb-1">
        {icon}
        <div>
          <p className="text-sm font-semibold text-text-primary">{step.label}</p>
          <p className="text-xs text-text-muted">{step.desc}</p>
        </div>
        <span className={`ml-auto text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded ${
          status === "running" ? "bg-cyan/10 text-cyan"
          : status === "done"   ? "bg-green/10 text-green"
          : status === "error"  ? "bg-red/10 text-red"
          : "text-text-muted"
        }`}>
          {status}
        </span>
      </div>
      {logs?.length > 0 && (
        <div className="mt-2 max-h-32 overflow-y-auto bg-slate/30 rounded p-2 font-mono text-[10px] text-text-muted space-y-0.5">
          {logs.map((l, i) => (
            <div key={i} className="leading-relaxed">{l}</div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function MetricsPanel({ perf }) {
  if (!perf) return null;
  const clf = perf.classifier;
  const reg = perf.regressor;
  const bestClf = clf?.models?.[clf?.best_model];
  const bestReg = reg?.models?.[reg?.best_model];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-6">
      <h2 className="text-sm font-semibold tracking-widest uppercase text-text-secondary">Trained Model Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Classifier */}
        <div className="glass-card p-5 border border-cyan/20">
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-3">Damage Classifier</p>
          <p className="text-xl font-bold text-text-primary mb-1">{clf?.best_model}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { l: "Accuracy",    v: bestClf ? `${(bestClf.accuracy * 100).toFixed(1)}%` : "—" },
              { l: "F1 Weighted", v: bestClf ? bestClf.f1_weighted?.toFixed(4) : "—" },
              { l: "Precision",   v: bestClf ? bestClf.precision?.toFixed(4) : "—" },
              { l: "Recall",      v: bestClf ? bestClf.recall?.toFixed(4) : "—" },
            ].map(({ l, v }) => (
              <div key={l} className="bg-slate/30 rounded p-2">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">{l}</p>
                <p className="font-mono text-sm font-bold text-cyan">{v}</p>
              </div>
            ))}
          </div>
          {bestClf?.cv_f1 && (
            <p className="mt-3 text-xs text-text-muted font-mono">
              5-Fold CV F1: {bestClf.cv_f1.mean?.toFixed(4)} ± {bestClf.cv_f1.std?.toFixed(4)}
            </p>
          )}
        </div>

        {/* Regressor */}
        <div className="glass-card p-5 border border-green/20">
          <p className="text-xs font-mono text-green tracking-widest uppercase mb-3">RUL Regressor</p>
          <p className="text-xl font-bold text-text-primary mb-1">{reg?.best_model}</p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[
              { l: "RMSE",  v: bestReg ? `${bestReg.rmse?.toFixed(0)} cycles` : "—" },
              { l: "MAE",   v: bestReg ? `${bestReg.mae?.toFixed(0)} cycles` : "—" },
              { l: "R²",    v: bestReg ? bestReg.r2?.toFixed(4) : "—" },
              { l: "MAPE",  v: bestReg ? `${bestReg.mape?.toFixed(2)}%` : "—" },
            ].map(({ l, v }) => (
              <div key={l} className="bg-slate/30 rounded p-2">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">{l}</p>
                <p className="font-mono text-sm font-bold text-green">{v}</p>
              </div>
            ))}
          </div>
          {bestReg?.cv_rmse && (
            <p className="mt-3 text-xs text-text-muted font-mono">
              5-Fold CV RMSE: {bestReg.cv_rmse.mean?.toFixed(0)} ± {bestReg.cv_rmse.std?.toFixed(0)}
            </p>
          )}
        </div>
      </div>

      {/* All model comparison table */}
      {clf?.models && (
        <div className="glass-card p-4">
          <p className="text-xs font-semibold tracking-widest uppercase text-text-secondary mb-3">
            All Classifier Comparison
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-text-muted">
                  <th className="text-left py-1 pr-4">Model</th>
                  <th className="text-right py-1 pr-4">Accuracy</th>
                  <th className="text-right py-1 pr-4">F1 (weighted)</th>
                  <th className="text-right py-1 pr-4">CV F1</th>
                  <th className="text-right py-1">Precision</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(clf.models).map(([name, m]) => (
                  <tr key={name} className={`border-t border-border/30 ${name === clf.best_model ? "text-cyan" : "text-text-secondary"}`}>
                    <td className="py-1.5 pr-4">
                      {name}{name === clf.best_model && <span className="ml-2 text-[9px] text-cyan/60">★ BEST</span>}
                    </td>
                    <td className="text-right py-1.5 pr-4">{(m.accuracy * 100).toFixed(1)}%</td>
                    <td className="text-right py-1.5 pr-4">{m.f1_weighted?.toFixed(4)}</td>
                    <td className="text-right py-1.5 pr-4">{m.cv_f1?.mean?.toFixed(4)}</td>
                    <td className="text-right py-1.5">{m.precision?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function TrainingPipeline() {
  const [phase,      setPhase]      = useState("idle"); // idle | training | done | error
  const [stepStatus, setStepStatus] = useState({});     // { simulate: 'done', ... }
  const [stepLogs,   setStepLogs]   = useState({});
  const [finalMsg,   setFinalMsg]   = useState(null);
  const [perfData,   setPerfData]   = useState(null);
  const abortRef = useRef(null);

  // Load existing perf on mount
  useEffect(() => {
    fetchModelPerformance().then(setPerfData).catch(() => {});
  }, []);

  const startTraining = () => {
    if (phase === "training") return;
    setPhase("training");
    setStepStatus({});
    setStepLogs({});
    setFinalMsg(null);

    abortRef.current = triggerTraining((event) => {
      if (event.step) {
        if (event.status) {
          setStepStatus((prev) => ({ ...prev, [event.step]: event.status }));
        }
        if (event.log) {
          setStepLogs((prev) => ({
            ...prev,
            [event.step]: [...(prev[event.step] || []), event.log],
          }));
        }
      }
      if (event.status === "complete") {
        setPhase("done");
        setFinalMsg(event.message);
        fetchModelPerformance().then(setPerfData).catch(() => {});
      }
      if (event.status === "failed") {
        setPhase("error");
        setFinalMsg(event.error);
      }
    });
  };

  const stopTraining = () => {
    abortRef.current?.();
    setPhase("idle");
  };

  return (
    <motion.div variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-gunmetal pt-20 pb-12 px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">ML Pipeline</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Training Pipeline</h1>
          <p className="text-sm text-text-muted mt-1">
            Generate synthetic CFRP data and train all ML models end-to-end.
            Takes ~2–4 minutes depending on hardware.
          </p>
        </div>

        {/* Control */}
        <div className="flex items-center gap-4 mb-8">
          <motion.button
            id="start-training-btn"
            whileHover={{ scale: 1.03, boxShadow: "0 0 24px rgba(0,212,255,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={startTraining}
            disabled={phase === "training"}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {phase === "training" ? "Training..." : phase === "done" ? "Retrain Models" : "Start Training"}
          </motion.button>

          {phase === "training" && (
            <button onClick={stopTraining}
              className="px-4 py-2 text-xs font-semibold text-red border border-red/30 rounded hover:bg-red/5 transition-colors">
              Abort
            </button>
          )}

          {phase === "done" && (
            <span className="flex items-center gap-2 text-sm text-green font-semibold">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
              All models trained successfully
            </span>
          )}
          {phase === "error" && (
            <span className="text-sm text-red font-semibold">Training failed — see logs below</span>
          )}
        </div>

        {/* Pipeline steps */}
        <AnimatePresence>
          {phase !== "idle" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 mb-6">
              {STEPS.map((step) => (
                <StepRow
                  key={step.key}
                  step={step}
                  status={stepStatus[step.key] || (phase === "training" ? "idle" : "idle")}
                  logs={stepLogs[step.key] || []}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final message */}
        {finalMsg && (
          <div className={`glass-card p-3 text-sm font-mono mb-4 border ${
            phase === "done" ? "border-green/30 text-green" : "border-red/30 text-red"
          }`}>
            {finalMsg}
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border my-6" />

        {/* Existing model performance */}
        <MetricsPanel perf={perfData} />
        {!perfData && phase === "idle" && (
          <div className="glass-card p-6 text-center">
            <p className="text-text-muted text-sm">No trained models found. Run the training pipeline above.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
