/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Engineering dark palette ──────────────────────────────────────────
        gunmetal:  "#0F1117",
        slate:     "#1C2333",
        surface:   "#242B3D",
        border:    "#2E3A52",
        // Accents
        cyan:      "#00D4FF",
        "cyan-dim":"#0099BB",
        amber:     "#F59E0B",
        green:     "#10B981",
        red:       "#EF4444",
        orange:    "#F97316",
        // Text
        "text-primary":   "#E8EDF5",
        "text-secondary": "#8A9BB5",
        "text-muted":     "#4A5568",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      borderRadius: {
        sm:  "2px",
        DEFAULT: "4px",
        md:  "6px",
        lg:  "8px",
      },
      boxShadow: {
        "cyan-glow":   "0 0 20px rgba(0, 212, 255, 0.25)",
        "cyan-glow-sm":"0 0 8px rgba(0, 212, 255, 0.15)",
        "card":        "0 4px 24px rgba(0, 0, 0, 0.4)",
      },
      animation: {
        shimmer:     "shimmer 1.5s infinite",
        "fade-in":   "fadeIn 0.4s ease",
        "slide-up":  "slideUp 0.5s ease",
        "count-up":  "countUp 2s ease",
      },
      keyframes: {
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0"  },
        },
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(20px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      backgroundImage: {
        "shimmer-gradient": "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
