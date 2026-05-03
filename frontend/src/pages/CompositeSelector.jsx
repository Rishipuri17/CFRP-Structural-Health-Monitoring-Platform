/**
 * CompositeSelector.jsx — Panel/coupon selection grid with detail sidebar.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { fetchPanels, fetchPanelMetadata } from "../api/client.js";
import CompositeCard from "../components/CompositeCard.jsx";

const PAGE_VARIANTS = {
  initial:  { opacity: 0, y: 16 },
  animate:  { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:     { opacity: 0, y: -12, transition: { duration: 0.25 } },
};

export default function CompositeSelector() {
  const navigate = useNavigate();
  const [panels,   setPanels]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [selected, setSelected] = useState(null);
  const [meta,     setMeta]     = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    fetchPanels()
      .then(setPanels)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = async (panel) => {
    setSelected(panel);
    setMetaLoading(true);
    try {
      const m = await fetchPanelMetadata(panel.panelId);
      setMeta(m);
    } catch {
      setMeta(null);
    } finally {
      setMetaLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selected) return;
    sessionStorage.setItem("selectedPanel", JSON.stringify({ ...selected, ...meta }));
    navigate("/signals");
  };

  return (
    <motion.div
      variants={PAGE_VARIANTS}
      initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-gunmetal pt-20 pb-12 px-6"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">Step 1 of 5</p>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Select Test Coupon</h1>
          <p className="text-text-secondary mt-1.5 text-sm">
            Choose a CFRP composite panel from the dataset. Each panel represents a unique
            material system and fatigue life record.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Panel grid */}
          <div className="flex-1">
            {loading && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="skeleton h-64 rounded" />
                ))}
              </div>
            )}

            {error && (
              <div className="glass-card p-6 border-red/30 bg-red/5">
                <p className="text-red font-semibold">⚠ Failed to load panels</p>
                <p className="text-text-muted text-sm mt-1">{error}</p>
                <p className="text-text-muted text-xs mt-3">
                  Ensure the backend is running and training is complete.
                </p>
              </div>
            )}

            {!loading && !error && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {panels.map((panel) => (
                  <CompositeCard
                    key={panel.panelId}
                    panel={panel}
                    selected={selected?.panelId === panel.panelId}
                    onClick={() => handleSelect(panel)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail sidebar */}
          <AnimatePresence>
            {selected && (
              <motion.aside
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ type: "spring", bounce: 0.15 }}
                className="w-72 flex-shrink-0"
              >
                <div className="glass-card p-5 sticky top-20">
                  <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-4">
                    Panel Details
                  </p>

                  {metaLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-8 rounded" />)}
                    </div>
                  ) : (
                    <dl className="space-y-3">
                      {[
                        ["Panel ID",    selected.panelId],
                        ["Material",    meta?.material    || selected.material],
                        ["Layup",       meta?.layup       || selected.layup],
                        ["Max Cycles",  (meta?.maxCycles  || selected.maxCycles)?.toLocaleString()],
                        ["Sensors",     `${meta?.sensorCount || 16} PZT channels`],
                        ["Snapshots",   meta?.cycleCount   || "—"],
                        ["Source",      meta?.source === "nasa" ? "NASA Dataset" : "Synthetic"],
                      ].map(([key, val]) => (
                        <div key={key} className="flex justify-between items-start border-b border-border pb-2">
                          <dt className="text-xs text-text-muted">{key}</dt>
                          <dd className="text-xs font-mono font-semibold text-text-primary text-right max-w-[55%]">
                            {val ?? "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirm}
                    id="confirm-panel-btn"
                    className="btn-primary w-full mt-5 text-center"
                  >
                    Analyze This Coupon →
                  </motion.button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
