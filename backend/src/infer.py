"""
infer.py — Python Inference Engine
Called by Node.js pythonBridge.js via child_process.
Accepts CLI args and prints a single JSON object to stdout.

Usage:
  python src/infer.py classify   <panel_id> <cycle>
  python src/infer.py rul        <panel_id> <cycle>
  python src/infer.py shap       <panel_id> <cycle>
  python src/infer.py signal     <panel_id> <cycle> <channel>
  python src/infer.py signals_all <panel_id> <cycle>
  python src/infer.py panels
  python src/infer.py metadata   <panel_id>
  python src/infer.py importance
  python src/infer.py performance
"""
import sys
import os
import json
import logging
import warnings
import numpy as np
import joblib
import pandas as pd

warnings.filterwarnings("ignore")
logging.basicConfig(level=logging.WARNING)

# ── path setup ────────────────────────────────────────────────────────────────
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)

from config import (
    CLASSIFIER_PATH, REGRESSOR_PATH, SCALER_PATH,
    CLASSIFIER_METRICS_PATH, REGRESSOR_METRICS_PATH,
    DAMAGE_STATES, DAMAGE_COLORS, RUL_ALERT_THRESHOLD,
)
from src.data_loader import DataLoader
from src.feature_extractor import FeatureExtractor
from src.explainer import SHAPExplainer
from src.evaluate import build_rul_history

# ── helpers ───────────────────────────────────────────────────────────────────

_loader    = DataLoader()
_extractor = FeatureExtractor()

def _load_models():
    if not (os.path.exists(CLASSIFIER_PATH) and os.path.exists(REGRESSOR_PATH)):
        return None, None, None
    clf    = joblib.load(CLASSIFIER_PATH)
    reg    = joblib.load(REGRESSOR_PATH)
    scaler = joblib.load(SCALER_PATH)
    return clf, reg, scaler


def _get_features(panel_id: str, cycle: int, scaler):
    records = _loader.load_panel(panel_id)
    if not records:
        raise ValueError(f"Panel '{panel_id}' not found or empty.")

    # Find nearest cycle
    cycles = [r["cycle"] for r in records]
    closest_idx = int(np.argmin([abs(c - cycle) for c in cycles]))
    rec = records[closest_idx]

    feats = _extractor.extract_one(rec["signals"])
    X = pd.DataFrame([feats])
    for col in ["cycle", "panel_id", "max_cycles", "life_fraction",
                "damage_label", "damage_state", "rul", "rul_normalized"]:
        X.drop(columns=[col], errors="ignore", inplace=True)

    X_scaled = scaler.transform(X.fillna(0))
    return X_scaled, X, rec, records, closest_idx


# ── command handlers ──────────────────────────────────────────────────────────

def cmd_panels():
    ids = _loader.get_panel_ids()
    print(json.dumps(ids))


def cmd_metadata(panel_id: str):
    meta = _loader.get_panel_metadata(panel_id)
    print(json.dumps(meta))


def cmd_signal(panel_id: str, cycle: int, channel: int):
    records = _loader.load_panel(panel_id)
    cycles  = [r["cycle"] for r in records]
    idx     = int(np.argmin([abs(c - cycle) for c in cycles]))
    rec     = records[idx]
    sig     = rec["signals"][channel].tolist()
    t       = np.linspace(0, len(sig) / 1.2e6 * 1e6, len(sig)).tolist()  # µs
    print(json.dumps({"cycle": rec["cycle"], "channel": channel, "time_us": t, "amplitude": sig}))


def cmd_signals_all(panel_id: str, cycle: int):
    records = _loader.load_panel(panel_id)
    cycles  = [r["cycle"] for r in records]
    idx     = int(np.argmin([abs(c - cycle) for c in cycles]))
    rec     = records[idx]
    n_ch    = rec["signals"].shape[0]
    t       = np.linspace(0, rec["signals"].shape[1] / 1.2e6 * 1e6, rec["signals"].shape[1]).tolist()

    channels = []
    for ch in range(n_ch):
        sig = rec["signals"][ch]
        channels.append({
            "channel": ch,
            "amplitude": sig.tolist(),
            "rms": float(np.sqrt(np.mean(sig ** 2))),
            "peak": float(np.max(np.abs(sig))),
        })
    print(json.dumps({"cycle": rec["cycle"], "time_us": t, "channels": channels}))


def cmd_classify(panel_id: str, cycle: int):
    clf, _, scaler = _load_models()
    if clf is None:
        print(json.dumps({"error": "Models not trained. Run training pipeline first.", "status": 503}))
        return

    X_scaled, _, rec, _, _ = _get_features(panel_id, cycle, scaler)
    probs = clf.predict_proba(X_scaled)[0].tolist()
    label_idx = int(np.argmax(probs))
    label     = DAMAGE_STATES[label_idx]
    confidence = float(max(probs))

    print(json.dumps({
        "cycle":         rec["cycle"],
        "label":         label,
        "label_index":   label_idx,
        "confidence":    confidence,
        "probabilities": {DAMAGE_STATES[i]: probs[i] for i in range(4)},
        "color":         DAMAGE_COLORS[label_idx],
        "alert":         label_idx >= 3,
    }))


def cmd_rul(panel_id: str, cycle: int):
    _, reg, scaler = _load_models()
    if reg is None:
        print(json.dumps({"error": "Models not trained. Run training pipeline first.", "status": 503}))
        return

    X_scaled, _, rec, records, closest_idx = _get_features(panel_id, cycle, scaler)
    predicted_rul = float(max(0, reg.predict(X_scaled)[0]))
    true_rul      = float(max(0, rec["max_cycles"] - rec["cycle"]))
    rul_norm      = predicted_rul / rec["max_cycles"]

    history = build_rul_history(reg, records, scaler, _extractor, closest_idx)

    hours_at_1hz = predicted_rul / 3600.0

    print(json.dumps({
        "cycle":             rec["cycle"],
        "rul":               predicted_rul,
        "rul_true":          true_rul,
        "rul_normalized":    rul_norm,
        "max_cycles":        rec["max_cycles"],
        "alert":             rul_norm < RUL_ALERT_THRESHOLD,
        "hours_estimated":   round(hours_at_1hz, 1),
        "degradation_rate":  history["degradation_rate"],
        "history":           history,
    }))


def cmd_shap(panel_id: str, cycle: int):
    clf, _, scaler = _load_models()
    if clf is None:
        print(json.dumps({"error": "Models not trained.", "status": 503}))
        return

    records = _loader.load_panel(panel_id)
    if not records:
        print(json.dumps({"error": f"Panel '{panel_id}' not found.", "status": 404}))
        return

    # Build feature matrix for all cycles (background)
    rows = []
    for rec in records:
        feats = _extractor.extract_one(rec["signals"])
        X = pd.DataFrame([feats])
        for col in ["cycle", "panel_id", "max_cycles", "life_fraction",
                    "damage_label", "damage_state", "rul", "rul_normalized"]:
            X.drop(columns=[col], errors="ignore", inplace=True)
        rows.append(X)

    X_all = pd.concat(rows, ignore_index=True).fillna(0)
    feature_names = X_all.columns.tolist()
    X_all_scaled  = scaler.transform(X_all)

    # Current sample
    X_scaled, X_raw, rec, _, _ = _get_features(panel_id, cycle, scaler)

    explainer = SHAPExplainer()
    result    = explainer.compute_shap(clf, X_scaled, X_all_scaled, feature_names, target_class=0)
    global_imp = explainer.get_global_importance(clf, X_all_scaled, feature_names, top_n=20)

    print(json.dumps({
        "cycle":         rec["cycle"],
        "shap_values":   result["shap_values"],
        "base_value":    result["base_value"],
        "feature_names": result["feature_names"],
        "global_importance": global_imp,
    }))


def cmd_importance():
    clf, _, scaler = _load_models()
    if clf is None:
        print(json.dumps({"error": "Models not trained.", "status": 503}))
        return

    loader    = DataLoader()
    extractor = FeatureExtractor()
    all_data  = loader.load_mat_files()

    rows = []
    for rec in all_data[:30]:  # limit for speed
        feats = extractor.extract_one(rec["signals"])
        X = pd.DataFrame([feats])
        for col in ["cycle", "panel_id", "max_cycles", "life_fraction",
                    "damage_label", "damage_state", "rul", "rul_normalized"]:
            X.drop(columns=[col], errors="ignore", inplace=True)
        rows.append(X)

    X_all = pd.concat(rows, ignore_index=True).fillna(0)
    feature_names = X_all.columns.tolist()
    X_scaled = scaler.transform(X_all)

    explainer = SHAPExplainer()
    importance = explainer.get_global_importance(clf, X_scaled, feature_names, top_n=20)
    print(json.dumps(importance))


def cmd_performance():
    result = {}
    for fpath, key in [(CLASSIFIER_METRICS_PATH, "classifier"), (REGRESSOR_METRICS_PATH, "regressor")]:
        if os.path.exists(fpath):
            with open(fpath) as f:
                result[key] = json.load(f)
        else:
            result[key] = None
    print(json.dumps(result))


# ── dispatch ──────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print(json.dumps({"error": "No command provided"}))
        sys.exit(1)

    cmd = args[0]
    try:
        if cmd == "panels":
            cmd_panels()
        elif cmd == "metadata" and len(args) >= 2:
            cmd_metadata(args[1])
        elif cmd == "signal" and len(args) >= 4:
            cmd_signal(args[1], int(args[2]), int(args[3]))
        elif cmd == "signals_all" and len(args) >= 3:
            cmd_signals_all(args[1], int(args[2]))
        elif cmd == "classify" and len(args) >= 3:
            cmd_classify(args[1], int(args[2]))
        elif cmd == "rul" and len(args) >= 3:
            cmd_rul(args[1], int(args[2]))
        elif cmd == "shap" and len(args) >= 3:
            cmd_shap(args[1], int(args[2]))
        elif cmd == "importance":
            cmd_importance()
        elif cmd == "performance":
            cmd_performance()
        else:
            print(json.dumps({"error": f"Unknown command or missing args: {' '.join(args)}"}))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e), "status": 500}))
        sys.exit(1)
