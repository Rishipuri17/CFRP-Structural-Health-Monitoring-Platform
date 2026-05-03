/**
 * MetricCard.jsx — Stat card with optional mini sparkline trend indicator.
 */
import React from "react";
import { motion } from "framer-motion";
import { LineChart, Line, ResponsiveContainer } from "recharts";

/**
 * @param {Object} props
 * @param {string}   props.label       - Metric label
 * @param {string}   props.value       - Primary display value
 * @param {string}   [props.unit]      - Unit suffix
 * @param {string}   [props.sublabel]  - Secondary label
 * @param {string}   [props.color]     - Accent color (tailwind class or hex)
 * @param {number[]} [props.sparkData] - Array of numbers for mini sparkline
 * @param {string}   [props.trend]     - "up" | "down" | "neutral"
 * @param {boolean}  [props.alert]     - Show alert styling
 */
export default function MetricCard({
  label, value, unit = "", sublabel, color = "#00D4FF",
  sparkData, trend, alert = false,
}) {
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const trendColor = trend === "up" ? "#10B981" : trend === "down" ? "#EF4444" : "#8A9BB5";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`metric-card flex flex-col gap-2 ${alert ? "border-red/40 bg-red/5" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold tracking-widest uppercase text-text-secondary">
          {label}
        </span>
        {trend && (
          <span className="text-xs font-mono font-bold" style={{ color: trendColor }}>
            {trendIcon}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold font-mono tracking-tight"
              style={{ color }}
            >
              {value}
            </span>
            {unit && <span className="text-xs text-text-muted font-mono">{unit}</span>}
          </div>
          {sublabel && (
            <p className="text-xs text-text-muted mt-0.5">{sublabel}</p>
          )}
        </div>

        {sparkData && sparkData.length > 1 && (
          <div className="w-20 h-10 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData.map((v, i) => ({ i, v }))}>
                <Line
                  type="monotone" dataKey="v" dot={false}
                  stroke={color} strokeWidth={1.5} isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
