/**
 * DamageClassifier.jsx — Damage state classification with probability bars,
 * SVG confidence gauge, confusion matrix, and cross-validation metrics.
 */
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from "recharts";
import { classifyDamage, fetchModelPerformance } from "../api/client.js";
import DamageGauge from "../components/DamageGauge.jsx";
import MetricCard  from "../components/MetricCard.jsx";

const STATE_COLORS = { "Healthy":"#10B981", "Early Damage":"#F59E0B", "Moderate Damage":"#F97316", "Severe Damage":"#EF4444" };
const STATE_LABELS  = ["Healthy","Early Damage","Moderate Damage","Severe Damage"];

const PAGE_VARIANTS = {
  initial: { opacity:0, y:16 }, animate: { opacity:1, y:0, transition:{duration:0.4} }, exit: { opacity:0, y:-12 },
};

function SkeletonBlock({ h = "h-48" }) {
  return <div className={`skeleton rounded ${h}`} />;
}

function ConfusionMatrix({ cm }) {
  if (!cm?.length) return null;
  const labels = ["H","ED","MD","SD"];
  const maxVal = Math.max(...cm.flat(), 1);
  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-3">
        Confusion Matrix — Test Set
      </h3>
      <div className="overflow-x-auto">
        <table className="text-xs font-mono mx-auto">
          <thead>
            <tr>
              <th className="w-8" />
              {labels.map((l) => <th key={l} className="w-12 text-center text-text-muted pb-2">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {cm.map((row, ri) => (
              <tr key={ri}>
                <td className="pr-2 text-text-muted text-right">{labels[ri]}</td>
                {row.map((val, ci) => {
                  const intensity = val / maxVal;
                  const isCorrect = ri === ci;
                  return (
                    <td key={ci} className="w-12 h-10 text-center border border-border/30 rounded"
                      style={{
                        background: isCorrect
                          ? `rgba(0,212,255,${0.1 + intensity*0.5})`
                          : `rgba(239,68,68,${intensity*0.4})`,
                        color: intensity > 0.3 ? "#E8EDF5" : "#8A9BB5",
                      }}>
                      {val}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-text-muted mt-2 text-center">
        H=Healthy · ED=Early · MD=Moderate · SD=Severe
      </p>
    </div>
  );
}

export default function DamageClassifier() {
  const panel    = JSON.parse(sessionStorage.getItem("selectedPanel") || "{}");
  const panelId  = panel.panelId;
  const maxCycles = panel.maxCycles || panel.max_cycles || 18000;

  const [cycle,      setCycle]   = useState(Math.floor(maxCycles * 0.3));
  const [result,     setResult]  = useState(null);
  const [loading,    setLoading] = useState(false);
  const [error,      setError]   = useState(null);
  const [perfData,   setPerfData]= useState(null);

  useEffect(() => {
    fetchModelPerformance().then(setPerfData).catch(() => {});
  }, []);

  const handleClassify = async () => {
    setLoading(true); setError(null);
    try { setResult(await classifyDamage(panelId, cycle)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const probData = result
    ? STATE_LABELS.map((l) => ({ label: l, prob: (result.probabilities?.[l] || 0) * 100, color: STATE_COLORS[l] }))
    : [];

  const clfMetrics = perfData?.classifier?.models;
  const bestModelName = perfData?.classifier?.best_model;
  const bestMetrics   = clfMetrics?.[bestModelName];

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
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">Step 3 of 5 · {panelId}</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Damage Classifier</h1>
        </div>

        {/* Controls row */}
        <div className="glass-card p-4 mb-6 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4 flex-1">
            <label className="text-xs text-text-secondary font-semibold uppercase tracking-wider whitespace-nowrap">
              Cycle
            </label>
            <input type="range" min={0} max={maxCycles} step={Math.floor(maxCycles/100)}
              value={cycle} onChange={(e) => setCycle(Number(e.target.value))} className="flex-1" />
            <span className="font-mono text-cyan text-sm w-20 text-right">{cycle.toLocaleString()}</span>
          </div>
          <motion.button
            whileHover={{ scale: 1.03, boxShadow: "0 0 20px rgba(0,212,255,0.3)" }}
            whileTap={{ scale: 0.97 }}
            onClick={handleClassify}
            disabled={loading}
            id="run-classify-btn"
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running..." : "Run Classification"}
          </motion.button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <SkeletonBlock h="h-64" /><SkeletonBlock h="h-64" /><SkeletonBlock h="h-64" />
          </div>
        )}

        {error && (
          <div className="glass-card p-4 border-red/30 bg-red/5 mb-6">
            <p className="text-red">{error}</p>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
              className="space-y-4"
            >
              {/* Main result row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Damage state badge */}
                <div className="glass-card p-6 flex flex-col items-center justify-center gap-3">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: result.color }} />
                  <div
                    className="text-2xl font-extrabold tracking-tight text-center"
                    style={{ color: result.color, textShadow: `0 0 20px ${result.color}66` }}
                  >
                    {result.label}
                  </div>
                  <p className="text-xs text-text-muted text-center">
                    At cycle <span className="font-mono text-text-primary">{result.cycle?.toLocaleString()}</span>,
                    the model detects <strong style={{ color: result.color }}>{result.label}</strong> with{" "}
                    <strong className="text-cyan">{(result.confidence * 100).toFixed(1)}%</strong> confidence.
                  </p>
                </div>

                {/* Confidence gauge */}
                <div className="glass-card p-4 flex items-center justify-center">
                  <DamageGauge confidence={result.confidence} label={result.label} size={160} />
                </div>

                {/* Probability bars */}
                <div className="glass-card p-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-text-secondary mb-3">
                    Class Probabilities
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={probData} margin={{ top:5, right:30, bottom:5, left:0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="label" tick={{ fontSize:9, fontFamily:"JetBrains Mono" }} />
                      <YAxis domain={[0,100]} tick={{ fontSize:9, fontFamily:"JetBrains Mono" }}
                        tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, "Probability"]}
                        contentStyle={{ background:"#1C2333", border:"1px solid #2E3A52", borderRadius:4, fontSize:11 }} />
                      <Bar dataKey="prob" radius={[2,2,0,0]}>
                        {probData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={result.label === entry.label ? 1 : 0.4} />
                        ))}
                        <LabelList dataKey="prob" position="top"
                          formatter={(v) => `${v.toFixed(0)}%`}
                          style={{ fontSize:9, fontFamily:"JetBrains Mono", fill:"#8A9BB5" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Model performance section */}
        {perfData?.classifier && (
          <div className="mt-6 space-y-4">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-text-secondary">
              Model Performance
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Best Model"   value={bestModelName || "—"}   color="#00D4FF" />
              <MetricCard label="Accuracy"     value={bestMetrics ? `${(bestMetrics.accuracy*100).toFixed(1)}%` : "—"} color="#10B981" />
              <MetricCard label="F1 (weighted)" value={bestMetrics ? bestMetrics.f1_weighted?.toFixed(4) : "—"} color="#F59E0B" />
              <MetricCard label="CV F1 Mean"   value={bestMetrics ? bestMetrics.cv_f1?.mean?.toFixed(4) : "—"} color="#8B5CF6" />
            </div>

            {bestMetrics?.confusion_matrix && (
              <ConfusionMatrix cm={bestMetrics.confusion_matrix} />
            )}

            {bestMetrics?.cv_f1 && (
              <div className="glass-card p-4">
                <h3 className="text-xs font-semibold tracking-widest uppercase text-text-secondary mb-3">
                  5-Fold Cross-Validation F1
                </h3>
                <div className="flex items-center gap-3 flex-wrap">
                  {bestMetrics.cv_f1.scores.map((s, i) => (
                    <div key={i} className="metric-card px-3 py-2 text-center">
                      <p className="text-[10px] text-text-muted">Fold {i+1}</p>
                      <p className="font-mono text-sm font-bold text-cyan">{s.toFixed(4)}</p>
                    </div>
                  ))}
                  <div className="metric-card px-3 py-2 text-center border-cyan/30">
                    <p className="text-[10px] text-text-muted">Mean ± Std</p>
                    <p className="font-mono text-sm font-bold text-cyan">
                      {bestMetrics.cv_f1.mean.toFixed(4)} ± {bestMetrics.cv_f1.std.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
