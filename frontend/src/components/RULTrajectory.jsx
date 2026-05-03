/**
 * RULTrajectory.jsx — Composed chart: actual vs predicted RUL with CI band.
 */
import React from "react";
import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";

/**
 * @param {Object}   props
 * @param {number[]} props.cycles
 * @param {number[]} props.actualRUL
 * @param {number[]} props.predictedRUL
 * @param {number[]} props.confidenceLower
 * @param {number[]} props.confidenceUpper
 * @param {number}   props.maxCycles
 */
export default function RULTrajectory({
  cycles = [], actualRUL = [], predictedRUL = [],
  confidenceLower = [], confidenceUpper = [], maxCycles = 18000,
}) {
  const data = cycles.map((c, i) => ({
    cycle:           c,
    actual:          actualRUL[i]         != null ? +actualRUL[i].toFixed(0)          : null,
    predicted:       predictedRUL[i]      != null ? +predictedRUL[i].toFixed(0)       : null,
    band:            (confidenceLower[i]  != null && confidenceUpper[i] != null)
      ? [+confidenceLower[i].toFixed(0), +confidenceUpper[i].toFixed(0)]
      : null,
  }));

  const criticalRUL = maxCycles * 0.2;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="eng-tooltip">
        <p className="text-text-muted mb-1">Cycle {label?.toLocaleString()}</p>
        {payload.map((p) => p.name !== "band" && (
          <p key={p.name} style={{ color: p.stroke || p.fill }}>
            {p.name}: <strong>{p.value?.toLocaleString()} cycles</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-4">
        RUL Trajectory
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
          <defs>
            <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#00D4FF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#00D4FF" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="cycle"
            label={{ value: "Fatigue Cycle", position: "insideBottom", offset: -10, fill: "#8A9BB5", fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <YAxis
            label={{ value: "RUL (cycles)", angle: -90, position: "insideLeft", fill: "#8A9BB5", fontSize: 11 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono", paddingTop: 8 }} />

          {/* CI band */}
          <Area
            dataKey="band" name="90% CI"
            fill="url(#bandGrad)" stroke="none"
            isAnimationActive={false}
          />

          {/* Critical threshold line */}
          <ReferenceLine
            y={criticalRUL}
            stroke="#EF4444" strokeDasharray="6 3"
            label={{ value: "CRITICAL 20%", fill: "#EF4444", fontSize: 10, fontFamily: "JetBrains Mono" }}
          />

          <Line dataKey="actual"    name="Actual RUL"    stroke="#10B981" strokeWidth={2} dot={false} isAnimationActive={false} />
          <Line dataKey="predicted" name="Predicted RUL" stroke="#00D4FF" strokeWidth={2} dot={false} strokeDasharray="8 3" isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
