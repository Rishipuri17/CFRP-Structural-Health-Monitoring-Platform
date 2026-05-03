/**
 * SHAPInsights.jsx — SHAP explainability page.
 * Panel A: global importance bar chart
 * Panel B: custom SVG waterfall chart (no external SHAP library)
 * Panel C: sortable feature attribution table
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchSHAP } from "../api/client.js";
import SHAPPlot from "../components/SHAPPlot.jsx";

const PAGE_VARIANTS = {
  initial: { opacity:0, y:16 }, animate: { opacity:1, y:0, transition:{duration:0.4} }, exit: { opacity:0, y:-12 },
};

const CH_COLORS = [
  "#00D4FF","#10B981","#F59E0B","#EF4444",
  "#8B5CF6","#EC4899","#06B6D4","#84CC16",
  "#F97316","#3B82F6","#A78BFA","#34D399",
  "#FCD34D","#F87171","#60A5FA","#C084FC",
];

/* ── Custom SVG waterfall ────────────────────────────────────────────────── */
function WaterfallChart({ shapValues = [], featureNames = [], baseValue = 0 }) {
  if (!shapValues.length) return null;

  // Pick top 12 by absolute SHAP
  const indexed = shapValues.map((v, i) => ({ v, name: featureNames[i] || `F${i}` }));
  indexed.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const top = indexed.slice(0, 12);

  const svgW     = 700;
  const barH     = 28;
  const barGap   = 6;
  const labelW   = 150;
  const chartH   = (barH + barGap) * (top.length + 2) + 40;
  const paddingX = 20;
  const chartW   = svgW - labelW - paddingX * 2;

  // Compute running totals
  const finalVal = baseValue + top.reduce((s, d) => s + d.v, 0);
  const domain   = [
    Math.min(baseValue, finalVal, ...top.map((d) => d.v < 0 ? baseValue + d.v : baseValue)) - 0.01,
    Math.max(baseValue, finalVal, ...top.map((d) => d.v > 0 ? baseValue + d.v : baseValue)) + 0.01,
  ];
  const range = domain[1] - domain[0] || 1;
  const toX = (v) => ((v - domain[0]) / range) * chartW + labelW + paddingX;

  let running = baseValue;
  const bars = top.map((d) => {
    const x1 = toX(Math.min(running, running + d.v));
    const x2 = toX(Math.max(running, running + d.v));
    const y  = 30 + (top.indexOf(d)) * (barH + barGap);
    const prev = running;
    running   += d.v;
    return { ...d, x1, x2, y, prev, cur: running, positive: d.v >= 0 };
  });
  const zeroX = toX(0);
  const baseX = toX(baseValue);

  return (
    <div className="glass-card p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-3">
        Prediction Breakdown (Waterfall)
      </h3>
      <svg width={svgW} height={chartH} style={{ fontFamily:"JetBrains Mono" }}>
        {/* Zero line */}
        <line x1={zeroX} y1={0} x2={zeroX} y2={chartH - 20} stroke="#2E3A52" strokeWidth={1} strokeDasharray="4 3" />
        {/* Base line */}
        <line x1={baseX} y1={0} x2={baseX} y2={chartH - 20} stroke="#8A9BB5" strokeWidth={1} strokeDasharray="3 2" />
        <text x={baseX} y={chartH - 5} textAnchor="middle" fill="#8A9BB5" fontSize={9}>base</text>

        {/* Bars */}
        {bars.map((bar, i) => {
          const color  = bar.positive ? "#00D4FF" : "#F59E0B";
          const barW   = Math.max(2, bar.x2 - bar.x1);
          const ch     = bar.name.startsWith("CH") ? parseInt(bar.name.slice(2, 4)) : 0;
          return (
            <g key={i}>
              {/* Feature label */}
              <text x={labelW + paddingX - 6} y={bar.y + barH / 2 + 4} textAnchor="end" fill="#8A9BB5" fontSize={9}>
                {bar.name.length > 18 ? bar.name.slice(0, 18) + "…" : bar.name}
              </text>
              {/* Bar */}
              <rect x={bar.x1} y={bar.y} width={barW} height={barH}
                fill={color} fillOpacity={0.8} rx={2}
                style={{ filter:`drop-shadow(0 0 4px ${color}66)` }}
              />
              {/* Value label */}
              <text
                x={bar.positive ? bar.x2 + 4 : bar.x1 - 4}
                y={bar.y + barH/2 + 4}
                textAnchor={bar.positive ? "start" : "end"}
                fill={color} fontSize={9}
              >
                {bar.v > 0 ? "+" : ""}{bar.v.toFixed(4)}
              </text>
              {/* Connector */}
              {i < bars.length - 1 && (
                <line x1={toX(bar.cur)} y1={bar.y + barH} x2={toX(bar.cur)} y2={bar.y + barH + barGap + 1}
                  stroke="#2E3A52" strokeWidth={1} />
              )}
            </g>
          );
        })}

        {/* Final value bar */}
        {(() => {
          const fy  = 30 + top.length * (barH + barGap);
          const fx1 = toX(Math.min(0, finalVal));
          const fw  = Math.abs(toX(finalVal) - toX(0));
          return (
            <g>
              <text x={labelW + paddingX - 6} y={fy + barH/2 + 4} textAnchor="end" fill="#E8EDF5" fontSize={9} fontWeight="bold">
                f(x)
              </text>
              <rect x={fx1} y={fy} width={Math.max(2,fw)} height={barH}
                fill={finalVal >= 0 ? "#00D4FF" : "#EF4444"} fillOpacity={0.9} rx={2} />
              <text x={toX(finalVal) + (finalVal >= 0 ? 4 : -4)} y={fy + barH/2 + 4}
                textAnchor={finalVal >= 0 ? "start" : "end"} fill="#E8EDF5" fontSize={9} fontWeight="bold">
                {finalVal.toFixed(4)}
              </text>
            </g>
          );
        })()}
      </svg>
      <p className="text-[10px] text-text-muted mt-2">
        Cyan → increases damage risk · Amber → decreases risk · Base value: {baseValue.toFixed(4)}
      </p>
    </div>
  );
}

/* ── Attribution table ───────────────────────────────────────────────────── */
function AttributionTable({ shapValues = [], featureNames = [] }) {
  const [sortBy,    setSortBy]    = useState("abs");
  const [filterCh,  setFilterCh]  = useState("all");

  const rows = shapValues.map((v, i) => ({
    feature: featureNames[i] || `F${i}`,
    shap:    v,
    absShap: Math.abs(v),
    channel: featureNames[i]?.startsWith("CH") ? parseInt(featureNames[i].slice(2,4)) : -1,
    direction: v > 0 ? "up" : v < 0 ? "down" : "neutral",
  }));

  const channels = [...new Set(rows.map((r) => r.channel).filter((c) => c >= 0))].sort((a,b)=>a-b);
  const filtered = rows.filter((r) => filterCh === "all" || r.channel === Number(filterCh));
  const sorted   = [...filtered].sort((a, b) =>
    sortBy === "abs"  ? b.absShap - a.absShap :
    sortBy === "shap" ? b.shap - a.shap :
    a.feature.localeCompare(b.feature)
  ).slice(0, 50);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary">
          Feature Attribution Table
        </h3>
        <div className="flex gap-2">
          <select
            value={filterCh} onChange={(e) => setFilterCh(e.target.value)}
            className="text-xs font-mono bg-slate border border-border text-text-secondary px-2 py-1 rounded"
          >
            <option value="all">All Channels</option>
            {channels.map((c) => <option key={c} value={c}>CH{String(c).padStart(2,"0")}</option>)}
          </select>
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="text-xs font-mono bg-slate border border-border text-text-secondary px-2 py-1 rounded"
          >
            <option value="abs">Sort by |SHAP|</option>
            <option value="shap">Sort by SHAP</option>
            <option value="name">Sort by Feature</option>
          </select>
        </div>
      </div>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-slate">
            <tr className="border-b border-border">
              {["Feature","Channel","SHAP Value","|SHAP|","Direction"].map((h) => (
                <th key={h} className="pb-2 text-left text-text-muted font-semibold pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i} className="border-b border-border/40 hover:bg-surface/50">
                <td className="py-1.5 pr-4 text-text-primary">{row.feature}</td>
                <td className="py-1.5 pr-4">
                  {row.channel >= 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{ background: `${CH_COLORS[row.channel % 16]}22`, color: CH_COLORS[row.channel % 16] }}>
                      CH{String(row.channel).padStart(2,"0")}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-4" style={{ color: row.shap > 0 ? "#00D4FF" : row.shap < 0 ? "#F59E0B" : "#8A9BB5" }}>
                  {row.shap > 0 ? "+" : ""}{row.shap.toFixed(5)}
                </td>
                <td className="py-1.5 pr-4 text-text-secondary">{row.absShap.toFixed(5)}</td>
                <td className="py-1.5 pr-4">
                  <span style={{ color: row.direction === "up" ? "#EF4444" : row.direction === "down" ? "#10B981" : "#8A9BB5" }}>
                    {row.direction === "up" ? "↑ risk" : row.direction === "down" ? "↓ risk" : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SHAPInsights() {
  const panel    = JSON.parse(sessionStorage.getItem("selectedPanel") || "{}");
  const panelId  = panel.panelId;
  const maxCycles= panel.maxCycles || 18000;

  const [cycle,   setCycle]   = useState(Math.floor(maxCycles * 0.5));
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const handleCompute = async () => {
    setLoading(true); setError(null);
    try { setResult(await fetchSHAP(panelId, cycle)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (!panelId) return (
    <div className="min-h-screen bg-gunmetal pt-20 flex items-center justify-center">
      <p className="text-text-muted">No panel selected. <a href="/select" className="text-cyan">Go back →</a></p>
    </div>
  );

  return (
    <motion.div variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-gunmetal pt-20 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">Step 5 of 5 · {panelId}</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">SHAP Insights</h1>
          <p className="text-text-secondary text-sm mt-1">Explainable AI: understand which features drive the damage prediction.</p>
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
            onClick={handleCompute}
            disabled={loading}
            id="compute-shap-btn"
            className="btn-primary disabled:opacity-50"
          >
            {loading ? "Computing SHAP..." : "Compute SHAP"}
          </motion.button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="skeleton h-96 rounded" />
            <div className="skeleton h-64 rounded" />
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
              {/* Panel A: global importance */}
              <SHAPPlot data={result.global_importance || []} />

              {/* Panel B: waterfall */}
              <WaterfallChart
                shapValues={result.shap_values || []}
                featureNames={result.feature_names || []}
                baseValue={result.base_value || 0}
              />

              {/* Panel C: table */}
              <AttributionTable
                shapValues={result.shap_values || []}
                featureNames={result.feature_names || []}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
