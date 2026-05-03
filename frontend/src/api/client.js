/**
 * client.js — Centralised API client for all CFRP SHM backend calls.
 * All fetch() calls live here; components import named functions only.
 *
 * In production (Vercel): VITE_API_URL points to the Render backend.
 * In local dev: Vite proxy forwards /api → http://localhost:5001.
 */

// VITE_API_URL is set as an env var in Vercel dashboard (e.g. https://cfrp-shm-api.onrender.com)
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

/** Throw an error with JSON body details if response is not OK */
async function handleResponse(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = body.detail || "";
    throw err;
  }
  return res.json();
}

// ── Panels ─────────────────────────────────────────────────────────────────
export const fetchPanels = () =>
  fetch(`${BASE}/panels`).then(handleResponse);

export const fetchPanelMetadata = (panelId) =>
  fetch(`${BASE}/panels/${encodeURIComponent(panelId)}/metadata`).then(handleResponse);

// ── Signals ────────────────────────────────────────────────────────────────
export const fetchSignal = (panelId, cycle, channel) =>
  fetch(`${BASE}/signal/${encodeURIComponent(panelId)}?cycle=${cycle}&channel=${channel}`)
    .then(handleResponse);

export const fetchAllSignals = (panelId, cycle) =>
  fetch(`${BASE}/signal/${encodeURIComponent(panelId)}/all?cycle=${cycle}`)
    .then(handleResponse);

// ── ML Inference ───────────────────────────────────────────────────────────
export const classifyDamage = (panelId, cycle) =>
  fetch(`${BASE}/ml/${encodeURIComponent(panelId)}/classify?cycle=${cycle}`, { method: "POST" })
    .then(handleResponse);

export const predictRUL = (panelId, cycle) =>
  fetch(`${BASE}/ml/${encodeURIComponent(panelId)}/rul?cycle=${cycle}`, { method: "POST" })
    .then(handleResponse);

export const fetchSHAP = (panelId, cycle) =>
  fetch(`${BASE}/ml/${encodeURIComponent(panelId)}/shap?cycle=${cycle}`)
    .then(handleResponse);

export const fetchFeatureImportance = (panelId) =>
  fetch(`${BASE}/ml/${encodeURIComponent(panelId)}/feature_importance`)
    .then(handleResponse);

export const fetchModelPerformance = () =>
  fetch(`${BASE}/ml/performance`).then(handleResponse);

export const fetchPredictionHistory = (panelId, type) =>
  fetch(`${BASE}/ml/${encodeURIComponent(panelId)}/history${type ? `?type=${type}` : ""}`)
    .then(handleResponse);

// ── Training (SSE stream) ──────────────────────────────────────────────────
/**
 * Trigger training pipeline and stream SSE events.
 * @param {(event: object) => void} onEvent - Callback for each SSE message.
 * @returns {() => void} Abort function.
 */
export const triggerTraining = (onEvent) => {
  const controller = new AbortController();

  fetch(`${BASE}/train`, {
    method: "POST",
    signal: controller.signal,
    headers: { Accept: "text/event-stream" },
  }).then(async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();
      for (const part of parts) {
        if (part.startsWith("data: ")) {
          try {
            onEvent(JSON.parse(part.slice(6)));
          } catch (_) { /* ignore */ }
        }
      }
    }
  }).catch((e) => {
    if (e.name !== "AbortError") console.error("SSE error:", e);
  });

  return () => controller.abort();
};
