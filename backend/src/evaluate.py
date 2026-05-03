"""
evaluate.py — Model Evaluation Utilities
Generates per-class reports and aggregated metric summaries.
"""
import os
import sys
import json
import logging
from typing import Dict, Any, List

import numpy as np
from sklearn.metrics import (
    classification_report, confusion_matrix,
    mean_squared_error, mean_absolute_error, r2_score,
)

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DAMAGE_STATES

logger = logging.getLogger(__name__)


def evaluate_classifier(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> Dict[str, Any]:
    """
    Generate comprehensive classifier evaluation metrics.

    Args:
        model: Fitted classifier.
        X_test: Scaled test features.
        y_test: True class labels.

    Returns:
        Dict with accuracy, f1, confusion_matrix, per_class metrics.
    """
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test) if hasattr(model, "predict_proba") else None

    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm     = confusion_matrix(y_test, y_pred, labels=[0, 1, 2, 3]).tolist()

    return {
        "accuracy":         float(report.get("accuracy", 0)),
        "f1_weighted":      float(report.get("weighted avg", {}).get("f1-score", 0)),
        "confusion_matrix": cm,
        "per_class": {
            DAMAGE_STATES[i]: {
                "precision": float(report.get(str(i), {}).get("precision", 0)),
                "recall":    float(report.get(str(i), {}).get("recall", 0)),
                "f1":        float(report.get(str(i), {}).get("f1-score", 0)),
                "support":   int(report.get(str(i), {}).get("support", 0)),
            }
            for i in range(4)
        },
        "probabilities_sample": y_prob[:5].tolist() if y_prob is not None else [],
    }


def evaluate_regressor(
    model: Any,
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> Dict[str, Any]:
    """
    Generate comprehensive regressor evaluation metrics.

    Args:
        model: Fitted regressor.
        X_test: Scaled test features.
        y_test: True RUL values.

    Returns:
        Dict with RMSE, MAE, R², MAPE.
    """
    y_pred = model.predict(X_test)

    rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
    mae  = float(mean_absolute_error(y_test, y_pred))
    r2   = float(r2_score(y_test, y_pred))

    # MAPE, ignore zero true values
    mask = y_test > 1e-6
    mape = float(np.mean(np.abs((y_test[mask] - y_pred[mask]) / y_test[mask])) * 100) if mask.any() else 0.0

    return {
        "rmse":  rmse,
        "mae":   mae,
        "r2":    r2,
        "mape":  mape,
        "y_pred_vs_true": {
            "y_pred": y_pred[:30].tolist(),
            "y_true": y_test[:30].tolist(),
        },
    }


def build_rul_history(
    model: Any,
    panel_records: List[Dict],
    scaler: Any,
    feature_extractor: Any,
    current_cycle_idx: int,
) -> Dict[str, Any]:
    """
    Build full RUL prediction history up to the current cycle.

    Args:
        model: Fitted regressor.
        panel_records: Sorted list of cycle dicts for the panel.
        scaler: Fitted StandardScaler.
        feature_extractor: FeatureExtractor instance.
        current_cycle_idx: Index of current cycle in panel_records.

    Returns:
        Dict with cycles, actual_rul, predicted_rul, confidence_lower, confidence_upper.
    """
    records_to_eval = panel_records[: current_cycle_idx + 1]
    cycles, actual_rul, predicted_rul = [], [], []

    for rec in records_to_eval:
        feats = feature_extractor.extract_one(rec["signals"])
        # Align features to training order
        import pandas as pd
        X = pd.DataFrame([feats])
        # Drop non-feature columns
        for col in ["cycle", "panel_id", "max_cycles", "life_fraction",
                    "damage_label", "damage_state", "rul", "rul_normalized"]:
            X.drop(columns=[col], errors="ignore", inplace=True)

        X_scaled  = scaler.transform(X.fillna(0))
        pred_rul  = float(model.predict(X_scaled)[0])
        true_rul  = float(rec["max_cycles"] - rec["cycle"])

        cycles.append(int(rec["cycle"]))
        actual_rul.append(max(0.0, true_rul))
        predicted_rul.append(max(0.0, pred_rul))

    # Simple confidence band: ±10% of prediction
    lower = [max(0.0, p * 0.90) for p in predicted_rul]
    upper = [p * 1.10 for p in predicted_rul]

    # Degradation rate (linear fit slope)
    if len(cycles) > 1:
        slope = float(np.polyfit(cycles, predicted_rul, 1)[0])
    else:
        slope = 0.0

    return {
        "cycles":            cycles,
        "actual_rul":        actual_rul,
        "predicted_rul":     predicted_rul,
        "confidence_lower":  lower,
        "confidence_upper":  upper,
        "degradation_rate":  slope,
    }
