"""
explainer.py — SHAP-based Model Explainability
Computes SHAP values for both classifier and regressor predictions.
Supports TreeExplainer (RF/XGB/GBT) and KernelExplainer (SVC).
"""
import os
import sys
import logging
import joblib
from typing import Dict, List, Any, Optional

import numpy as np
import pandas as pd
import shap

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import SHAP_BG_PATH, MODELS_PATH

logger = logging.getLogger(__name__)

_TREE_TYPES = ("RandomForestClassifier", "RandomForestRegressor",
               "XGBClassifier", "XGBRegressor",
               "GradientBoostingClassifier", "GradientBoostingRegressor")


class SHAPExplainer:
    """Wrapper around SHAP explainers for tree and kernel models."""

    def __init__(self) -> None:
        self._explainer: Optional[Any]  = None
        self._background: Optional[np.ndarray] = None

    # ── Public API ──────────────────────────────────────────────────────────────

    def compute_shap(
        self,
        model: Any,
        X_sample: np.ndarray,
        X_background: np.ndarray,
        feature_names: List[str],
        target_class: int = 0,
    ) -> Dict[str, Any]:
        """
        Compute SHAP values for X_sample w.r.t. the given model.

        Args:
            model: Fitted sklearn/XGB model.
            X_sample: Feature matrix for which to explain (n_samples, n_features).
            X_background: Background dataset for KernelExplainer.
            feature_names: List of feature names.
            target_class: Class index for multi-class classifiers.

        Returns:
            Dict with shap_values (list), base_value (float), feature_names (list).
        """
        self._build_explainer(model, X_background)

        raw = self._explainer.shap_values(X_sample)

        # Handle multi-class output (list of arrays per class)
        if isinstance(raw, list):
            # Pick the target class; fall back to class 0
            idx = min(target_class, len(raw) - 1)
            sv  = raw[idx]
        else:
            sv = raw

        # Mean SHAP values across samples if batch
        if sv.ndim == 2:
            sv_mean = sv[0]  # first sample
        else:
            sv_mean = sv

        base = self._get_base_value(target_class)

        return {
            "shap_values":   sv_mean.tolist(),
            "base_value":    float(base),
            "feature_names": feature_names,
        }

    def get_global_importance(
        self,
        model: Any,
        X: np.ndarray,
        feature_names: List[str],
        top_n: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Compute mean absolute SHAP values for global feature importance.

        Args:
            model: Fitted model.
            X: Feature matrix.
            feature_names: Feature name list.
            top_n: Number of top features to return.

        Returns:
            Sorted list of {feature, mean_abs_shap, channel} dicts.
        """
        self._build_explainer(model, X)
        raw = self._explainer.shap_values(X)

        if isinstance(raw, list):
            # Average across classes
            sv = np.mean([np.abs(r) for r in raw], axis=0)
        else:
            sv = np.abs(raw)

        mean_abs = np.mean(sv, axis=0)  # (n_features,)

        importance = []
        for i, (fname, val) in enumerate(zip(feature_names, mean_abs)):
            # Extract channel from feature name "CH00_rms"
            channel = int(fname.split("_")[0].replace("CH", "")) if fname.startswith("CH") else -1
            importance.append({
                "feature":        fname,
                "mean_abs_shap":  float(val),
                "channel":        channel,
                "rank":           0,
            })

        importance.sort(key=lambda x: x["mean_abs_shap"], reverse=True)
        for rank, item in enumerate(importance[:top_n]):
            item["rank"] = rank + 1

        return importance[:top_n]

    def save_background(self, X_background: np.ndarray) -> None:
        """Persist SHAP background dataset."""
        os.makedirs(MODELS_PATH, exist_ok=True)
        joblib.dump(X_background, SHAP_BG_PATH)
        logger.info(f"SHAP background saved → {SHAP_BG_PATH}")

    def load_background(self) -> Optional[np.ndarray]:
        """Load persisted background dataset."""
        if os.path.exists(SHAP_BG_PATH):
            return joblib.load(SHAP_BG_PATH)
        return None

    # ── Internal ────────────────────────────────────────────────────────────────

    def _build_explainer(self, model: Any, X_background: np.ndarray) -> None:
        """Build the appropriate SHAP explainer for the model type."""
        model_type = type(model).__name__
        if model_type in _TREE_TYPES:
            self._explainer = shap.TreeExplainer(model)
        else:
            # SVC or other non-tree model → KernelExplainer (slow, use small background)
            bg_summary = shap.kmeans(X_background, min(50, len(X_background)))
            self._explainer = shap.KernelExplainer(model.predict_proba, bg_summary)
        logger.debug(f"SHAP explainer: {type(self._explainer).__name__} for {model_type}")

    def _get_base_value(self, target_class: int = 0) -> float:
        """Extract base value from explainer."""
        if self._explainer is None:
            return 0.0
        bv = self._explainer.expected_value
        if isinstance(bv, (list, np.ndarray)):
            idx = min(target_class, len(bv) - 1)
            return float(bv[idx])
        return float(bv)
