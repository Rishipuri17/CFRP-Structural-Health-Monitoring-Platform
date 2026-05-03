/**
 * WaveformChart.jsx — Multi-channel Lamb wave signal visualiser.
 * Uses Recharts LineChart with brush zoom.
 */
import React, { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, Brush, ResponsiveContainer,
} from "recharts";

const CHANNEL_COLORS = [
  "#00D4FF","#10B981","#F59E0B","#EF4444",
  "#8B5CF6","#EC4899","#06B6D4","#84CC16",
  "#F97316","#3B82F6","#A78BFA","#34D399",
  "#FCD34D","#F87171","#60A5FA","#C084FC",
];

/**
 * @param {Object} props
 * @param {number[]} props.timeUs       - Time axis values in µs
 * @param {Object[]} props.channels     - Array of {channel, amplitude[]}
 * @param {number[]} props.activeChannels - Indices of channels to show
 * @param {string}   [props.title]
 */
export default function WaveformChart({ timeUs = [], channels = [], activeChannels = [0], title = "Lamb Wave Signals" }) {
  // Build chart data: array of { t, CH00, CH01, ... }
  const data = useMemo(() => {
    if (!timeUs.length || !channels.length) return [];
    // Downsample to 400 points for performance
    const step = Math.max(1, Math.floor(timeUs.length / 400));
    return timeUs.filter((_, i) => i % step === 0).map((t, idx) => {
      const row = { t: +t.toFixed(2) };
      channels.forEach((ch) => {
        if (activeChannels.includes(ch.channel)) {
          row[`CH${String(ch.channel).padStart(2, "0")}`] =
            +(ch.amplitude[idx * step] || 0).toFixed(4);
        }
      });
      return row;
    });
  }, [timeUs, channels, activeChannels]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="eng-tooltip">
        <p className="text-text-muted mb-1">{`t = ${label} µs`}</p>
        {payload.map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-4">
      <h3 className="text-sm font-semibold tracking-widest uppercase text-text-secondary mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            label={{ value: "Time (µs)", position: "insideBottom", offset: -10, fill: "#8A9BB5", fontSize: 11 }}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <YAxis
            label={{ value: "Amplitude", angle: -90, position: "insideLeft", fill: "#8A9BB5", fontSize: 11 }}
            tick={{ fontSize: 10, fontFamily: "JetBrains Mono" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, fontFamily: "JetBrains Mono", paddingTop: 8 }} />
          <Brush dataKey="t" height={24} stroke="#2E3A52" fill="#1C2333" travellerWidth={6} />
          {activeChannels.map((ch) => (
            <Line
              key={ch}
              type="monotone"
              dataKey={`CH${String(ch).padStart(2, "0")}`}
              stroke={CHANNEL_COLORS[ch % CHANNEL_COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
