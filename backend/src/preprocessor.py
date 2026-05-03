"""
preprocessor.py — Labels, RUL Calculation, and Feature Scaling
Transforms raw feature DataFrames into ML-ready train/test splits.
"""
import os
import logging
import joblib
from typing import Tuple, Dict

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    CYCLE_THRESHOLDS, DAMAGE_STATES, SCALER_PATH,
    RANDOM_STATE, TEST_SIZE, MODELS_PATH,
)

logger = logging.getLogger(__name__)


class Preprocessor:
    """Handles label assignment, RUL calculation, and feature scaling."""

    def __init__(self) -> None:
        self.scaler: StandardScaler = StandardScaler()
        self._scaler_fitted: bool = False

    # ── Label Assignment ────────────────────────────────────────────────────────

    @staticmethod
    def assign_damage_labels(df: pd.DataFrame) -> pd.DataFrame:
        """
        Assign 4-class damage labels based on normalised cycle position.

        Classes:
            0 — Healthy        (life fraction 0.00 – 0.25)
            1 — Early Damage   (life fraction 0.25 – 0.50)
            2 — Moderate Damage(life fraction 0.50 – 0.75)
            3 — Severe Damage  (life fraction 0.75 – 1.00)

        Args:
            df: Feature DataFrame with 'cycle' and 'max_cycles' columns.

        Returns:
            DataFrame with added 'damage_label' and 'life_fraction' columns.
        """
        df = df.copy()
        df["life_fraction"] = df["cycle"] / df["max_cycles"].clip(lower=1)

        thresholds = CYCLE_THRESHOLDS  # [0.25, 0.50, 0.75]
        labels = np.zeros(len(df), dtype=int)
        labels[df["life_fraction"] >= thresholds[0]] = 1
        labels[df["life_fraction"] >= thresholds[1]] = 2
        labels[df["life_fraction"] >= thresholds[2]] = 3

        df["damage_label"] = labels
        df["damage_state"]  = df["damage_label"].map(DAMAGE_STATES)

        class_counts = df["damage_state"].value_counts().to_dict()
        logger.info(f"Damage label distribution: {class_counts}")
        return df

    @staticmethod
    def calculate_rul(df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute Remaining Useful Life (RUL) per row.

        Args:
            df: DataFrame with 'cycle' and 'max_cycles' columns.

        Returns:
            DataFrame with 'rul' (raw cycle count) and 'rul_normalized' (0–1) columns.
        """
        df = df.copy()
        df["rul"]            = (df["max_cycles"] - df["cycle"]).clip(lower=0)
        df["rul_normalized"] = df["rul"] / df["max_cycles"].clip(lower=1)
        return df

    # ── Scaling ─────────────────────────────────────────────────────────────────

    def scale_features(
        self, X_train: pd.DataFrame, X_test: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Fit StandardScaler on training set and transform both splits.

        Args:
            X_train: Training feature DataFrame.
            X_test: Test feature DataFrame.

        Returns:
            Tuple of (X_train_scaled, X_test_scaled) as ndarrays.
        """
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled  = self.scaler.transform(X_test)
        self._scaler_fitted = True

        os.makedirs(MODELS_PATH, exist_ok=True)
        joblib.dump(self.scaler, SCALER_PATH)
        logger.info(f"Scaler fitted and saved → {SCALER_PATH}")
        return X_train_scaled, X_test_scaled

    def transform(self, X: pd.DataFrame) -> np.ndarray:
        """Transform features using already-fitted scaler."""
        if not self._scaler_fitted:
            self.scaler = joblib.load(SCALER_PATH)
            self._scaler_fitted = True
        return self.scaler.transform(X)

    # ── Data Splitting ──────────────────────────────────────────────────────────

    @staticmethod
    def split_data(
        df: pd.DataFrame,
        feature_cols: list,
        test_size: float = TEST_SIZE,
    ) -> Dict[str, any]:
        """
        Stratified train/test split returning both classifier and regressor targets.

        Args:
            df: Preprocessed DataFrame with feature and target columns.
            feature_cols: List of feature column names.
            test_size: Fraction of data held out for testing.

        Returns:
            Dict with X_train, X_test, y_class_train, y_class_test,
            y_rul_train, y_rul_test, and meta information.
        """
        X = df[feature_cols].fillna(0)
        y_class = df["damage_label"]
        y_rul   = df["rul"]

        X_train, X_test, y_class_train, y_class_test, y_rul_train, y_rul_test = (
            train_test_split(
                X, y_class, y_rul,
                test_size=test_size,
                stratify=y_class,
                random_state=RANDOM_STATE,
            )
        )

        logger.info(
            f"Split: train={len(X_train)}, test={len(X_test)} | "
            f"classes={y_class.nunique()}"
        )
        return {
            "X_train":        X_train,
            "X_test":         X_test,
            "y_class_train":  y_class_train,
            "y_class_test":   y_class_test,
            "y_rul_train":    y_rul_train,
            "y_rul_test":     y_rul_test,
            "feature_cols":   feature_cols,
        }

    # ── Convenience ─────────────────────────────────────────────────────────────

    @staticmethod
    def get_feature_cols(df: pd.DataFrame) -> list:
        """Return feature column names (exclude metadata / target columns)."""
        exclude = {
            "cycle", "panel_id", "max_cycles", "life_fraction",
            "damage_label", "damage_state", "rul", "rul_normalized",
        }
        return [c for c in df.columns if c not in exclude]
