/**
 * SignalExplorer.jsx — Waveform signal explorer with cycle scrubber and sensor grid.
 * Layout: 30% left controls | 70% right charts.
 */
import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { fetchAllSignals, fetchPanelMetadata } from "../api/client.js";
import WaveformChart from "../components/WaveformChart.jsx";
import SensorGrid    from "../components/SensorGrid.jsx";
import MetricCard    from "../components/MetricCard.jsx";

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -12 },
};

export default function SignalExplorer() {
  const panel    = JSON.parse(sessionStorage.getItem("selectedPanel") || "{}");
  const panelId  = panel.panelId;
  const maxCycles = panel.maxCycles || panel.max_cycles || 18000;

  const [cycle,       setCycle]       = useState(0);
  const [signalData,  setSignalData]  = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [activeChannels, setActiveChannels] = useState([0, 1, 2, 3]);
  const [availableCycles, setAvailCycles]   = useState([]);
  const debounceRef = useRef(null);

  // Load metadata for available cycles
  useEffect(() => {
    if (!panelId) return;
    fetchPanelMetadata(panelId).then((m) => {
      const cycles = m.availableCycles || m.available_cycles || [];
      setAvailCycles(cycles);
      if (cycles.length) setCycle(cycles[0]);
    }).catch(() => {});
  }, [panelId]);

  const loadSignals = useCallback(async (c) => {
    if (!panelId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllSignals(panelId, c);
      setSignalData(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [panelId]);

  // Debounced load on cycle change
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadSignals(cycle), 300);
  }, [cycle, loadSignals]);

  const toggleChannel = (ch) =>
    setActiveChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );

  // Stat metrics from signal data
  const allAmps   = signalData?.channels?.flatMap((c) => c.amplitude) || [];
  const minAmp    = allAmps.length ? Math.min(...allAmps).toFixed(4) : "—";
  const maxAmp    = allAmps.length ? Math.max(...allAmps).toFixed(4) : "—";
  const avgRMS    = signalData?.channels?.length
    ? (signalData.channels.reduce((s, c) => s + (c.rms || 0), 0) / signalData.channels.length).toFixed(4)
    : "—";

  if (!panelId) {
    return (
      <div className="min-h-screen bg-gunmetal pt-20 flex items-center justify-center">
        <p className="text-text-muted">No panel selected. <a href="/select" className="text-cyan">Go back →</a></p>
      </div>
    );
  }

  return (
    <motion.div
      variants={PAGE_VARIANTS} initial="initial" animate="animate" exit="exit"
      className="min-h-screen bg-gunmetal pt-20 pb-12"
    >
      <div className="max-w-7xl mx-auto px-6 flex gap-6">
        {/* ── Left panel: controls ─────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 space-y-4">
          <div className="glass-card p-4">
            <p className="text-xs font-mono text-cyan tracking-widest uppercase mb-1">Panel</p>
            <p className="font-bold text-text-primary text-sm">{panelId}</p>
            <p className="text-xs text-text-muted">{panel.material} · {panel.layup}</p>
          </div>

          {/* Cycle scrubber */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-widest">Cycle</p>
              <span className="font-mono text-cyan font-bold text-sm">{cycle.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min={availableCycles[0] || 0}
              max={availableCycles[availableCycles.length - 1] || maxCycles}
              step={availableCycles.length > 1 ? availableCycles[1] - availableCycles[0] : 1}
              value={cycle}
              onChange={(e) => setCycle(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-text-muted mt-1 font-mono">
              <span>0</span>
              <span>{maxCycles.toLocaleString()}</span>
            </div>
            <div className="mt-2 h-1.5 rounded bg-border overflow-hidden">
              <div
                className="h-full rounded bg-gradient-to-r from-green to-red transition-all"
                style={{ width: `${(cycle / maxCycles) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1">
              Life fraction: <span className="text-cyan font-mono">{((cycle / maxCycles) * 100).toFixed(1)}%</span>
            </p>
          </div>

          {/* Sensor grid */}
          <div className="glass-card p-4">
            <SensorGrid
              channels={signalData?.channels || []}
              selected={activeChannels}
              onToggle={toggleChannel}
            />
          </div>

          {/* Quick stats */}
          <div className="space-y-2">
            <MetricCard label="Min Amplitude" value={minAmp} color="#8A9BB5" />
            <MetricCard label="Max Amplitude" value={maxAmp} color="#EF4444" />
            <MetricCard label="Mean RMS" value={avgRMS} color="#00D4FF" />
          </div>
        </aside>

        {/* ── Right panel: charts ──────────────────────────────────────────── */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-text-muted uppercase tracking-widest">Signal Explorer</p>
              <h1 className="text-2xl font-bold text-text-primary">Lamb Wave Signals</h1>
            </div>
            {loading && <span className="text-xs font-mono text-cyan animate-pulse">Loading...</span>}
          </div>

          {error && (
            <div className="glass-card p-4 border-red/30 bg-red/5">
              <p className="text-red text-sm">Error: {error}</p>
            </div>
          )}

          {loading && !signalData && (
            <div className="skeleton h-72 rounded" />
          )}

          {signalData && (
            <>
              <WaveformChart
                timeUs={signalData.time_us || []}
                channels={signalData.channels || []}
                activeChannels={activeChannels}
                title={`Waveforms — Cycle ${cycle.toLocaleString()} | Channels: ${activeChannels.map((c) => `S${c+1}`).join(", ")}`}
              />

              {/* Channel amplitude heatmap */}
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-3">
                  Peak Amplitude — All Channels
                </h3>
                <div className="space-y-1.5">
                  {(signalData.channels || []).map((ch) => {
                    const maxPeak = Math.max(...(signalData.channels || []).map((c) => c.peak || 0), 1);
                    const norm = (ch.peak || 0) / maxPeak;
                    const r = Math.round(norm * 239); const g = Math.round((1-norm) * 185 + norm * 68);
                    const b = Math.round((1-norm) * 129 + norm * 68);
                    return (
                      <div key={ch.channel} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-muted w-8">S{ch.channel+1}</span>
                        <div className="flex-1 h-4 bg-border rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${norm*100}%`, background: `rgb(${r},${g},${b})`, opacity: 0.8 }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-text-muted w-14 text-right">
                          {(ch.peak||0).toFixed(4)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
