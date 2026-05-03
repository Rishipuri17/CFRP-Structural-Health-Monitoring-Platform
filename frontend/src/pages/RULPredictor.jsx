/**
 * RULPredictor.jsx — Remaining Useful Life prediction with trajectory chart,
 * health bar, model comparison table, and degradation rate.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { predictRUL, fetchModelPerformance } from "../api/client.js";
import RULTrajectory from "../components/RULTrajectory.jsx";
import MetricCard    from "../components/MetricCard.jsx";

const PAGE_VARIANTS = {
  initial: { opacity:0, y:16 }, animate: { opacity:1, y:0, transition:{duration:0.4} }, exit: { opacity:0, y:-12 },
};

function HealthBar({ rulNorm = 0 }) {
  const pct = Math.min(100, Math.max(0, (1 - rulNorm) * 100));
  const color = pct < 50 ? "#10B981" : pct < 75 ? "#F59E0B" : pct < 90 ? "#F97316" : "#EF4444";
  return (
    <div>
      <div className="flex justify-between text-xs text-text-muted mb-1 font-mono">
        <span>PRISTINE</span>
        <span className="font-bold" style={{ color }}>
          {pct.toFixed(1)}% life consumed
        </span>
        <span>FAILED</span>
      </div>
      <div className="relative h-5 rounded bg-border overflow-hidden">
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(90deg, #10B981 0%, #F59E0B 50%, #F97316 75%, #EF4444 100%)", opacity:0.2 }}
        />
        <motion.div
          className="absolute top-0 left-0 bottom-0 rounded"
          initial={{ width:0 }}
          animate={{ width:`${pct}%` }}
          transition={{ duration:1.2, ease:"easeOut" }}
          style={{ background: `linear-gradient(90deg, #10B981, ${color})`, opacity:0.8 }}
        />
        {/* Needle */}
        <motion.div
          className="absolute top-0 bottom-0 w-0.5 bg-white"
          initial={{ left:0 }}
          animate={{ left:`${pct}%` }}
          transition={{ duration:1.2, ease:"easeOut" }}
          style={{ boxShadow:"0 0 8px white" }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted mt-1 font-mono">
        <span>0%</span>
        <span className="text-red">CRITICAL 80%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

export default function RULPredictor() {
  const panel     = JSON.parse(sessionStorage.getItem("selectedPanel") || "{}");
  const panelId   = panel.panelId;
  const maxCycles = panel.maxCycles || panel.max_cycles || 18000;

  const [cycle,    setCycle]    = useState(Math.floor(maxCycles * 0.5));
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [perfData, setPerfData] = useState(null);

  useEffect(() => {
    fetchModelPerformance().then(setPerfData).catch(() => {});
  }, []);

  const handlePredict = async () => {
    setLoading(true); setError(null);
    try { setResult(await predictRUL(panelId, cycle)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const regModels = perfData?.regressor?.models || {};

  if (!panelId) return (
    <div className="min-h-screen bg-gunmetal pt-20 flex items-center justify-center">
      <p className="text-text-muted">No panel selected. <a href="/select" className="text-cyan">Go back →</a></p>
    </div>
  );

  return (
    <motion.div variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-gunmetal pt-20 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">Step 4 of 5 · {panelId}</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">RUL Predictor</h1>
          <p className="text-text-secondary text-sm mt-1">Remaining Useful Life estimation via ensemble regression</p>
        </div>

        {/* Controls */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider whitespace-nowrap">Cycle</label>
            <input type="range" min={0} max={maxCycles} step={Math.floor(maxCycles/100)}
              value={cycle} onChange={(e) => setCycle(Number(e.target.value))} className="flex-1" />
            <span className="font-mono text-cyan text-sm w-20 text-right">{cycle.toLocaleString()}</span>
          </div>
          <motion.button
            whileHover={{ scale:1.03, boxShadow:"0 0 20px rgba(0,212,255,0.3)" }}
            whileTap={{ scale:0.97 }}
            onClick={handlePredict}
            disabled={loading}
            id="run-rul-btn"
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Computing..." : "Predict Remaining Life"}
          </motion.button>
        </div>

        {loading && !result && (
          <div className="space-y-4">
            <div className="skeleton h-32 rounded" />
            <div className="skeleton h-72 rounded" />
          </div>
        )}

        {error && (
          <div className="glass-card p-4 border-red/30 bg-red/5 mb-6">
            <p className="text-red">{error}</p>
          </div>
        )}

        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              className="space-y-4"
            >
              {/* Hero RUL number */}
              <div className="glass-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
                  <div>
                    <p className="text-xs text-text-muted uppercase tracking-widest mb-1">Remaining Useful Life</p>
                    <div className="flex items-baseline gap-3">
                      <span
                        className="text-6xl font-extrabold font-mono tracking-tight"
                        style={{ color:"#00D4FF", textShadow:"0 0 30px rgba(0,212,255,0.5)" }}
                      >
                        {Math.round(result.rul).toLocaleString()}
                      </span>
                      <span className="text-xl text-text-secondary font-mono">cycles</span>
                    </div>
                    <p className="text-sm text-text-muted mt-1">
                      ≈ <span className="text-amber font-mono font-bold">{result.hours_estimated?.toFixed(1)}h</span> at standard test frequency
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="RUL Normalized" value={(result.rul_normalized*100).toFixed(1)} unit="%" color={result.alert?"#EF4444":"#10B981"} alert={result.alert} />
                    <MetricCard label="Degradation Rate" value={Math.abs(result.degradation_rate||0).toFixed(3)} unit="cycles/cyc" color="#F59E0B" trend="down" />
                  </div>
                </div>

                <HealthBar rulNorm={result.rul_normalized || 0} />

                {result.alert && (
                  <motion.div
                    initial={{ opacity:0 }} animate={{ opacity:1 }}
                    className="mt-4 p-3 border border-red/40 bg-red/10 rounded flex items-center gap-2"
                  >
                    <span className="text-red text-sm">⚠</span>
                    <p className="text-red text-sm font-semibold">
                      CRITICAL: Remaining life below 20% threshold. Immediate inspection recommended.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Trajectory chart */}
              {result.history && (
                <RULTrajectory
                  cycles={result.history.cycles}
                  actualRUL={result.history.actual_rul}
                  predictedRUL={result.history.predicted_rul}
                  confidenceLower={result.history.confidence_lower}
                  confidenceUpper={result.history.confidence_upper}
                  maxCycles={result.max_cycles}
                />
              )}

              {/* Model comparison table */}
              {Object.keys(regModels).length > 0 && (
                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-3">
                    Model Comparison
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-border">
                          {["Model","RMSE","MAE","R²","MAPE"].map((h) => (
                            <th key={h} className="pb-2 text-left text-text-muted font-semibold pr-4">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(regModels).map(([name, m]) => (
                          <tr key={name} className={`border-b border-border/50 ${name === perfData?.regressor?.best_model ? "bg-cyan/5" : ""}`}>
                            <td className="py-2 pr-4 text-text-primary font-semibold">
                              {name}
                              {name === perfData?.regressor?.best_model && (
                                <span className="ml-2 text-[10px] text-cyan">★ best</span>
                              )}
                            </td>
                            <td className="py-2 pr-4 text-amber">{m.rmse?.toFixed(1)}</td>
                            <td className="py-2 pr-4 text-text-secondary">{m.mae?.toFixed(1)}</td>
                            <td className="py-2 pr-4 text-green">{m.r2?.toFixed(4)}</td>
                            <td className="py-2 pr-4 text-text-secondary">{m.mape?.toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
