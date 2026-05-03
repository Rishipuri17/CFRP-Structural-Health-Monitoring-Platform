/**
 * SensorGrid.jsx — 4×4 heatmap grid showing peak amplitude per sensor.
 * Damaged sensors glow red; healthy sensors glow green.
 */
import React from "react";
import { motion } from "framer-motion";

/**
 * @param {Object}   props
 * @param {Object[]} props.channels     - Array of {channel, rms, peak}
 * @param {number[]} props.selected     - Currently selected channel indices
 * @param {Function} props.onToggle     - (channelIdx) => void
 */
export default function SensorGrid({ channels = [], selected = [], onToggle }) {
  if (!channels.length) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i} className="skeleton h-12 rounded" />
        ))}
      </div>
    );
  }

  const maxPeak = Math.max(...channels.map((c) => c.peak || 0), 1);

  return (
    <div>
      <p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-semibold">
        Sensor Array — 16 PZT Channels
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {channels.map((ch) => {
          const norm      = (ch.peak || 0) / maxPeak;        // 0–1
          const isActive  = selected.includes(ch.channel);
          // Color: low → cyan, high → red (damage indicator)
          const r = Math.round(norm * 239 + (1 - norm) * 0);
          const g = Math.round(norm * 68  + (1 - norm) * 212);
          const b = Math.round(norm * 68  + (1 - norm) * 255);
          const accentColor = `rgb(${r},${g},${b})`;

          return (
            <motion.button
              key={ch.channel}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onToggle?.(ch.channel)}
              id={`sensor-btn-${ch.channel}`}
              className={`
                relative rounded flex flex-col items-center justify-center
                h-14 text-xs font-mono border transition-all duration-200 cursor-pointer
                ${isActive
                  ? "bg-cyan/10 border-cyan shadow-cyan-glow-sm"
                  : "bg-slate border-border hover:border-cyan/30"
                }
              `}
            >
              {/* Damage fill bar */}
              <div
                className="absolute bottom-0 left-0 right-0 rounded-b transition-all duration-500"
                style={{
                  height: `${norm * 100}%`,
                  background: `${accentColor}18`,
                  borderTop: `1px solid ${accentColor}44`,
                }}
              />
              <span className="relative z-10 text-text-secondary text-[10px] tracking-wider">
                S{ch.channel + 1}
              </span>
              <span className="relative z-10 font-bold text-[10px]" style={{ color: accentColor }}>
                {(ch.rms || 0).toFixed(3)}
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="text-[10px] text-text-muted mt-1.5">RMS amplitude · red = high scatter → damage</p>
    </div>
  );
}
