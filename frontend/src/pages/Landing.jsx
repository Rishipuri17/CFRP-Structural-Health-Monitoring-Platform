/**
 * Landing.jsx — Full-viewport hero with canvas fiber weave animation.
 * Animated stat counters, tech badges, and CTA.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

/* ── Canvas fiber weave animation ─────────────────────────────────────────── */
function useFiberCanvas(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const LINES = 40;
    let offset = 0;
    let raf;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Diagonal woven threads — two directions
      for (let i = 0; i < LINES; i++) {
        const spacing = W / LINES;
        const x = (i * spacing + offset) % (W + spacing) - spacing;

        // Warp threads (top-left → bottom-right)
        ctx.beginPath();
        ctx.moveTo(x - H, 0);
        ctx.lineTo(x + H, H);
        const alphaWarp = 0.04 + 0.02 * Math.abs(Math.sin(i * 0.4 + offset * 0.01));
        ctx.strokeStyle = `rgba(0,212,255,${alphaWarp})`;
        ctx.lineWidth   = 0.8;
        ctx.stroke();

        // Weft threads (top-right → bottom-left)
        ctx.beginPath();
        ctx.moveTo(W - x + H, 0);
        ctx.lineTo(W - x - H, H);
        const alphaWeft = 0.03 + 0.015 * Math.abs(Math.cos(i * 0.3 + offset * 0.008));
        ctx.strokeStyle = `rgba(16,185,129,${alphaWeft})`;
        ctx.lineWidth   = 0.6;
        ctx.stroke();
      }

      // Over-under intersection highlights
      for (let r = 0; r < LINES; r++) {
        for (let c = 0; c < LINES; c++) {
          if ((r + c) % 2 === 0) {
            const cx = (c * (W / LINES) + offset) % W;
            const cy = (r * (H / LINES) + offset * 0.7) % H;
            const pulse = Math.abs(Math.sin(r * 0.5 + c * 0.3 + offset * 0.02));
            ctx.fillStyle = `rgba(0,212,255,${0.015 + 0.01 * pulse})`;
            ctx.fillRect(cx - 1, cy - 1, 2, 2);
          }
        }
      }

      offset += 0.3;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

/* ── Animated counter ─────────────────────────────────────────────────────── */
function AnimatedCounter({ target, label, suffix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 2000;
    const fps      = 60;
    const total    = duration / (1000 / fps);
    const step     = target / total;

    const timer = setInterval(() => {
      frame++;
      setCount((prev) => {
        const next = prev + step * (1 + frame / total); // ease-out
        return next >= target ? target : next;
      });
      if (frame >= total) clearInterval(timer);
    }, 1000 / fps);

    return () => clearInterval(timer);
  }, [target]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8 }}
      className="text-center"
    >
      <div className="text-4xl font-bold font-mono text-cyan mb-1">
        {Math.round(count).toLocaleString()}{suffix}
      </div>
      <div className="text-xs text-text-secondary tracking-widest uppercase font-semibold">{label}</div>
    </motion.div>
  );
}

const TECH_BADGES = ["React", "Node.js", "Express", "MongoDB", "scikit-learn", "XGBoost", "SHAP", "NASA Dataset"];

export default function Landing() {
  const canvasRef = useRef(null);
  const navigate  = useNavigate();
  useFiberCanvas(canvasRef);

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-gunmetal">
      {/* Canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.8 }}
      />

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(0,212,255,0.06) 0%, transparent 70%)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 py-20">
        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2 mb-8 px-4 py-1.5 border border-cyan/30 rounded bg-cyan/5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
          <span className="text-xs font-semibold text-cyan tracking-widest uppercase">
            NASA CFRP Composites Dataset
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.7 }}
          className="text-5xl md:text-7xl font-extrabold text-center leading-[1.05] tracking-tight mb-4"
        >
          <span className="text-text-primary">CFRP Structural</span>
          <br />
          <span className="text-cyan" style={{ textShadow: "0 0 40px rgba(0,212,255,0.4)" }}>
            Health Monitoring
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-base md:text-lg text-text-secondary text-center max-w-2xl mb-12 leading-relaxed"
        >
          ML-powered fatigue damage detection using Lamb wave signals from 16 PZT sensors.
          Real-time damage classification, RUL prediction, and SHAP explainability.
        </motion.p>

        {/* Stat counters */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-3 gap-12 mb-12"
        >
          <AnimatedCounter target={16}  label="PZT Sensors" />
          <AnimatedCounter target={288} label="Features / Cycle" />
          <AnimatedCounter target={4}   label="Damage States" />
        </motion.div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.04, boxShadow: "0 0 32px rgba(0,212,255,0.4)" }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/select")}
          id="begin-analysis-btn"
          className="btn-primary text-base px-10 py-4 text-lg"
          style={{ letterSpacing: "0.15em" }}
        >
          BEGIN ANALYSIS →
        </motion.button>
      </div>

      {/* Tech stack footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1 }}
        className="relative z-10 border-t border-border py-4 px-8"
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-3">
          {TECH_BADGES.map((badge) => (
            <span
              key={badge}
              className="px-3 py-1 text-[11px] font-mono text-text-muted border border-border rounded bg-slate/50 tracking-wider"
            >
              {badge}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
