/**
 * CompositeCard.jsx — Panel coupon card for the composite selector grid.
 */
import React from "react";
import { motion } from "framer-motion";

const MATERIAL_BADGES = {
  "IM7/8552":   { label: "IM7/8552",   bg: "bg-cyan/10",   text: "text-cyan"   },
  "T300/5208":  { label: "T300/5208",  bg: "bg-green/10",  text: "text-green"  },
  "AS4/3501-6": { label: "AS4/3501-6", bg: "bg-amber/10",  text: "text-amber"  },
  "IM6/Epoxy":  { label: "IM6/Epoxy",  bg: "bg-orange/10", text: "text-orange" },
};

/**
 * @param {Object}   props
 * @param {Object}   props.panel     - Panel metadata object
 * @param {boolean}  props.selected  - Whether this card is selected
 * @param {Function} props.onClick   - Click handler
 */
export default function CompositeCard({ panel, selected, onClick }) {
  const badge    = MATERIAL_BADGES[panel.material] || { label: panel.material, bg: "bg-surface", text: "text-text-secondary" };
  const usedFrac = panel.maxCycles > 0 ? Math.min(1, (panel.maxCycles - (panel.maxCycles * 0.3)) / panel.maxCycles) : 0.7;
  const lifeLeft = ((1 - usedFrac) * 100).toFixed(0);

  return (
    <motion.div
      whileHover={{ y: -4, boxShadow: "0 0 24px rgba(0,212,255,0.2)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      id={`panel-card-${panel.panelId}`}
      className={`
        glass-card p-4 cursor-pointer transition-all duration-200
        ${selected ? "border-cyan shadow-cyan-glow" : "border-border hover:border-cyan/30"}
      `}
    >
      {/* Carbon fiber texture header */}
      <div className="relative h-28 rounded mb-3 overflow-hidden">
        <div className="absolute inset-0 carbon-texture" style={{
          background: `
            repeating-linear-gradient(45deg, #1a1a2e 0px, #1a1a2e 2px, #0d0d1a 2px, #0d0d1a 8px),
            repeating-linear-gradient(-45deg, #1a2040 0px, #1a2040 2px, #0d1530 2px, #0d1530 8px)
          `,
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate via-transparent to-transparent" />
        {selected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan flex items-center justify-center">
            <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#0F1117" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {/* Layup badge */}
        <div className="absolute bottom-2 left-2">
          <span className="text-[10px] font-mono bg-gunmetal/80 border border-border px-2 py-0.5 rounded text-text-secondary">
            {panel.layup || "[0/90]s"}
          </span>
        </div>
      </div>

      {/* Panel ID */}
      <p className="text-[10px] font-mono text-text-muted tracking-widest mb-1">
        {panel.panelId}
      </p>

      {/* Material badge */}
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold mb-3 ${badge.bg} ${badge.text}`}>
        {badge.label}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider">Max Cycles</p>
          <p className="font-mono font-semibold text-text-primary">{(panel.maxCycles || 18000).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-text-muted text-[10px] uppercase tracking-wider">Sensors</p>
          <p className="font-mono font-semibold text-text-primary">{panel.sensorCount || 16} PZT</p>
        </div>
      </div>

      {/* Life bar */}
      <div>
        <div className="flex justify-between text-[10px] text-text-muted mb-1">
          <span>Fatigue Life Used</span>
          <span className="text-green font-mono">{lifeLeft}% remaining</span>
        </div>
        <div className="h-1.5 rounded bg-border overflow-hidden">
          <motion.div
            className="h-full rounded"
            initial={{ width: 0 }}
            animate={{ width: `${usedFrac * 100}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              background: usedFrac < 0.5
                ? "linear-gradient(90deg, #10B981, #F59E0B)"
                : "linear-gradient(90deg, #F59E0B, #EF4444)"
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
