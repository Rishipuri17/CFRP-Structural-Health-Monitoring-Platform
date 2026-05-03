"""
train_regressor.py — CFRP Remaining Useful Life (RUL) Regression Pipeline
Trains RF, XGB, GBT regressors; saves best model + metrics JSON.
"""
import os
import sys
import json
import logging
import warnings
import joblib
from typing import Dict, Any

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import KFold, cross_validate
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
from xgboost import XGBRegressor

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    RANDOM_STATE, CV_FOLDS, MODELS_PATH,
    REGRESSOR_PATH, REGRESSOR_METRICS_PATH,
)
from src.data_loader import DataLoader
from src.feature_extractor import FeatureExtractor
from src.preprocessor import Preprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def _mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error, avoiding division by zero."""
    mask = y_true > 1e-6
    if not mask.any():
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


class RegressionTrainer:
    """Trains and evaluates RUL regression models; saves the best."""

    MODELS = {
        "RandomForest": RandomForestRegressor(
            n_estimators=200, max_depth=None, min_samples_leaf=2,
            n_jobs=-1, random_state=RANDOM_STATE,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            random_state=RANDOM_STATE, verbosity=0,
        ),
        "GradientBoosting": GradientBoostingRegressor(
            n_estimators=150, max_depth=4, learning_rate=0.08,
            subsample=0.9, random_state=RANDOM_STATE,
        ),
    }

    def __init__(self) -> None:
        self.preprocessor = Preprocessor()
        self.best_model    = None
        self.best_name     = None
        self.metrics: Dict[str, Any] = {}

    def run(self) -> None:
        """Full pipeline: load → extract → preprocess → train → evaluate → save."""
        logger.info("=" * 60)
        logger.info("CFRP RUL Regression Training Pipeline")
        logger.info("=" * 60)

        # ── 1. Load ──────────────────────────────────────────────────────────────
        loader    = DataLoader()
        extractor = FeatureExtractor()
        all_data  = loader.load_mat_files()
        df        = extractor.extract_all(all_data)
        df        = Preprocessor.assign_damage_labels(df)
        df        = Preprocessor.calculate_rul(df)

        feature_cols = Preprocessor.get_feature_cols(df)
        split        = Preprocessor.split_data(df, feature_cols)

        # Use scaler already fitted by classifier training, or fit now
        try:
            X_train_s = self.preprocessor.transform(split["X_train"])
            X_test_s  = self.preprocessor.transform(split["X_test"])
        except Exception:
            X_train_s, X_test_s = self.preprocessor.scale_features(
                split["X_train"], split["X_test"]
            )

        y_train = split["y_rul_train"].values.astype(float)
        y_test  = split["y_rul_test"].values.astype(float)

        logger.info(f"RUL range: {y_train.min():.0f} – {y_train.max():.0f} cycles")

        # ── 2. Train & evaluate ─────────────────────────────────────────────────
        kf = KFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
        results: Dict[str, Dict] = {}
        best_rmse = float("inf")

        for name, model in self.MODELS.items():
            logger.info(f"\nTraining {name} ...")
            model.fit(X_train_s, y_train)
            y_pred = model.predict(X_test_s)

            rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
            mae  = float(mean_absolute_error(y_test, y_pred))
            r2   = float(r2_score(y_test, y_pred))
            mape = _mape(y_test, y_pred)

            # CV RMSE
            cv_res    = cross_validate(
                model, X_train_s, y_train, cv=kf,
                scoring="neg_root_mean_squared_error", n_jobs=-1,
            )
            cv_scores = (-cv_res["test_score"]).tolist()

            # Degradation rate: slope of predicted RUL vs cycle on training set
            train_cycles = split["X_train"]["cycle"].values if "cycle" in split["X_train"].columns else np.arange(len(y_train))
            deg_rate = float(np.polyfit(train_cycles, y_train, 1)[0]) if len(train_cycles) > 1 else 0.0

            results[name] = {
                "rmse":           rmse,
                "mae":            mae,
                "r2":             r2,
                "mape":           mape,
                "degradation_rate": deg_rate,
                "cv_rmse":        {"scores": cv_scores, "mean": float(np.mean(cv_scores)), "std": float(np.std(cv_scores))},
                "y_pred_sample":  y_pred[:20].tolist(),
                "y_true_sample":  y_test[:20].tolist(),
            }

            logger.info(f"  RMSE={rmse:.1f}  MAE={mae:.1f}  R²={r2:.4f}  MAPE={mape:.2f}%")

            if rmse < best_rmse:
                best_rmse       = rmse
                self.best_model = model
                self.best_name  = name

        # ── 3. Save ─────────────────────────────────────────────────────────────
        os.makedirs(MODELS_PATH, exist_ok=True)
        joblib.dump(self.best_model, REGRESSOR_PATH)
        logger.info(f"\n✓ Best regressor: {self.best_name} (RMSE={best_rmse:.1f})")
        logger.info(f"  Saved → {REGRESSOR_PATH}")

        self.metrics = {
            "best_model":     self.best_name,
            "best_rmse":      best_rmse,
            "feature_cols":   feature_cols,
            "models":         results,
        }
        with open(REGRESSOR_METRICS_PATH, "w") as f:
            json.dump(self.metrics, f, indent=2)
        logger.info(f"  Metrics saved → {REGRESSOR_METRICS_PATH}")
        logger.info("\n✓ Regression training complete.")


if __name__ == "__main__":
    trainer = RegressionTrainer()
    trainer.run()
