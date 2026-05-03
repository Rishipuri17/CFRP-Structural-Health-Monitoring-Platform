/**
 * SHAPPlot.jsx — Global feature importance horizontal bar chart.
 */
import React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from "recharts";

const CH_COLORS = [
  "#00D4FF","#10B981","#F59E0B","#EF4444",
  "#8B5CF6","#EC4899","#06B6D4","#84CC16",
  "#F97316","#3B82F6","#A78BFA","#34D399",
  "#FCD34D","#F87171","#60A5FA","#C084FC",
];

/**
 * @param {Object[]} props.data - Array of {feature, mean_abs_shap, channel}
 */
export default function SHAPPlot({ data = [] }) {
  const sorted = [...data].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap).slice(0, 20);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="eng-tooltip">
        <p className="font-bold text-text-primary">{d.feature}</p>
        <p className="text-text-muted">Channel: <span className="text-cyan">CH{d.channel}</span></p>
        <p className="text-text-muted">|SHAP|: <strong style={{ color: CH_COLORS[d.channel % 16] }}>{d.mean_abs_shap?.toFixed(5)}</strong></p>
      </div>
    );
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-4">
        Global Feature Importance — Mean |SHAP|
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 22)}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 60, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
            label={{ value: "Mean |SHAP value|", position: "insideBottom", offset: -5, fill: "#8A9BB5", fontSize: 11 }} />
          <YAxis dataKey="feature" type="category" width={130}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono", fill: "#8A9BB5" }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="mean_abs_shap" name="|SHAP|" radius={[0, 2, 2, 0]}>
            {sorted.map((entry, i) => (
              <Cell key={i} fill={CH_COLORS[entry.channel % 16]} fillOpacity={0.85} />
            ))}
            <LabelList dataKey="mean_abs_shap" position="right"
              formatter={(v) => v?.toFixed(4)}
              style={{ fontSize: 9, fontFamily: "JetBrains Mono", fill: "#8A9BB5" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
