/**
 * Navbar.jsx — Top navigation bar with active route highlighting.
 */
import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const LINKS = [
  { to: "/select",   label: "Coupons" },
  { to: "/signals",  label: "Signals" },
  { to: "/classify", label: "Classifier" },
  { to: "/rul",      label: "RUL" },
  { to: "/shap",     label: "SHAP" },
  { to: "/train",    label: "Train" },
];

export default function Navbar() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  if (isLanding) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-gunmetal/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 relative">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
              <path d="M3 12L12 3L21 12L12 21L3 12Z" stroke="#00D4FF" strokeWidth="1.5" fill="rgba(0,212,255,0.1)" />
              <path d="M12 3L12 21M3 12L21 12" stroke="#00D4FF44" strokeWidth="1" />
            </svg>
          </div>
          <span className="font-bold text-sm tracking-widest text-text-primary group-hover:text-cyan transition-colors">
            CFRP<span className="text-cyan">·</span>SHM
          </span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `relative px-4 py-1.5 text-xs font-semibold tracking-widest uppercase transition-colors rounded ${
                  isActive
                    ? "text-cyan"
                    : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-cyan/10 border border-cyan/30 rounded"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-2 text-xs text-text-muted font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          <span>LIVE</span>
        </div>
      </div>
    </nav>
  );
}
