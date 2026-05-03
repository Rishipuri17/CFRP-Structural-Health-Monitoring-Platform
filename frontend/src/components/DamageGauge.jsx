/**
 * DamageGauge.jsx — SVG arc confidence gauge for damage classification.
 */
import React from "react";
import { motion } from "framer-motion";

const STATE_COLORS = {
  "Healthy":          "#10B981",
  "Early Damage":     "#F59E0B",
  "Moderate Damage":  "#F97316",
  "Severe Damage":    "#EF4444",
};

/**
 * @param {Object} props
 * @param {number} props.confidence  - 0–1 confidence value
 * @param {string} props.label       - Damage state label
 * @param {number} props.size        - SVG size in px (default 160)
 */
export default function DamageGauge({ confidence = 0, label = "Unknown", size = 160 }) {
  const color    = STATE_COLORS[label] || "#8A9BB5";
  const cx       = size / 2;
  const cy       = size / 2;
  const R        = size * 0.38;
  const stroke   = size * 0.08;

  // Arc from -225° to 45° (270° sweep)
  const startAngle = -225 * (Math.PI / 180);
  const sweepAngle = 270  * (Math.PI / 180);
  const endAngle   = startAngle + sweepAngle * confidence;

  const polarToXY = (angle, r = R) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const describeArc = (start, end) => {
    const s = polarToXY(start);
    const e = polarToXY(end);
    const large = end - start > Math.PI ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const bgEnd = startAngle + sweepAngle;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path
          d={describeArc(startAngle, bgEnd)}
          fill="none"
          stroke="#2E3A52"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
        {/* Center text */}
        <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
          fontSize={size * 0.18} fontWeight="700" fontFamily="JetBrains Mono">
          {(confidence * 100).toFixed(1)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="#8A9BB5"
          fontSize={size * 0.07} fontFamily="JetBrains Mono">
          %
        </text>
        <text x={cx} y={cy + size * 0.22} textAnchor="middle" fill="#8A9BB5"
          fontSize={size * 0.07} fontFamily="Inter" fontWeight="600">
          confidence
        </text>
      </svg>
    </div>
  );
}
