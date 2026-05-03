import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
    // Local dev proxy — in production the client uses VITE_API_URL env var
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});

