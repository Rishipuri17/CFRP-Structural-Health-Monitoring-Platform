"""
train_classifier.py — CFRP Damage Classification Training Pipeline
Trains RF, XGB, GBT, SVC; picks best by weighted F1; saves model + metrics.
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
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    confusion_matrix, classification_report,
)
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    RANDOM_STATE, CV_FOLDS, MODELS_PATH,
    CLASSIFIER_PATH, CLASSIFIER_METRICS_PATH,
    DAMAGE_STATES,
)
from src.data_loader import DataLoader
from src.feature_extractor import FeatureExtractor
from src.preprocessor import Preprocessor

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


class ClassificationTrainer:
    """Trains and evaluates multiple damage classifiers, saves the best."""

    MODELS = {
        "RandomForest": RandomForestClassifier(
            n_estimators=200, max_depth=None, min_samples_leaf=2,
            n_jobs=-1, random_state=RANDOM_STATE,
        ),
        "XGBoost": XGBClassifier(
            n_estimators=200, max_depth=6, learning_rate=0.05,
            subsample=0.8, colsample_bytree=0.8,
            eval_metric="mlogloss",
            random_state=RANDOM_STATE, verbosity=0,
        ),
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=150, max_depth=4, learning_rate=0.08,
            subsample=0.9, random_state=RANDOM_STATE,
        ),
        "SVC": SVC(
            kernel="rbf", C=10.0, gamma="scale",
            probability=True, random_state=RANDOM_STATE,
        ),
    }

    def __init__(self) -> None:
        self.preprocessor = Preprocessor()
        self.best_model    = None
        self.best_name     = None
        self.metrics: Dict[str, Any] = {}

    def run(self) -> None:
        """Full training pipeline: load → features → preprocess → train → save."""
        logger.info("=" * 60)
        logger.info("CFRP Classification Training Pipeline")
        logger.info("=" * 60)

        # ── 1. Load data ────────────────────────────────────────────────────────
        loader    = DataLoader()
        extractor = FeatureExtractor()

        all_data = loader.load_mat_files()
        df = extractor.extract_all(all_data)

        # ── 2. Preprocess ───────────────────────────────────────────────────────
        df = Preprocessor.assign_damage_labels(df)
        df = Preprocessor.calculate_rul(df)

        feature_cols = Preprocessor.get_feature_cols(df)
        split = Preprocessor.split_data(df, feature_cols)

        X_train_s, X_test_s = self.preprocessor.scale_features(
            split["X_train"], split["X_test"]
        )
        y_train = split["y_class_train"].values
        y_test  = split["y_class_test"].values

        logger.info(f"Feature matrix: {X_train_s.shape[1]} features, "
                    f"{len(y_train)} train / {len(y_test)} test samples")

        # ── 3. Train & evaluate all models ─────────────────────────────────────
        skf = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
        results: Dict[str, Dict] = {}
        best_f1 = -1.0

        for name, model in self.MODELS.items():
            logger.info(f"\nTraining {name} ...")
            model.fit(X_train_s, y_train)
            y_pred = model.predict(X_test_s)
            y_prob = model.predict_proba(X_test_s) if hasattr(model, "predict_proba") else None

            acc  = float(accuracy_score(y_test, y_pred))
            f1_w = float(f1_score(y_test, y_pred, average="weighted"))
            f1_per_class = f1_score(y_test, y_pred, average=None, labels=[0, 1, 2, 3]).tolist()

            # Cross-validation
            cv_res = cross_validate(
                model, X_train_s, y_train, cv=skf,
                scoring=["accuracy", "f1_weighted"], n_jobs=-1,
            )
            cv_acc_scores = cv_res["test_accuracy"].tolist()
            cv_f1_scores  = cv_res["test_f1_weighted"].tolist()

            cm = confusion_matrix(y_test, y_pred, labels=[0, 1, 2, 3]).tolist()

            results[name] = {
                "accuracy":        acc,
                "f1_weighted":     f1_w,
                "f1_per_class":    {DAMAGE_STATES[i]: f1_per_class[i] for i in range(4)},
                "precision":       float(precision_score(y_test, y_pred, average="weighted")),
                "recall":          float(recall_score(y_test, y_pred, average="weighted")),
                "confusion_matrix": cm,
                "cv_accuracy":     {"scores": cv_acc_scores, "mean": float(np.mean(cv_acc_scores)), "std": float(np.std(cv_acc_scores))},
                "cv_f1":           {"scores": cv_f1_scores,  "mean": float(np.mean(cv_f1_scores)),  "std": float(np.std(cv_f1_scores))},
            }

            logger.info(f"  Accuracy={acc:.4f}  F1={f1_w:.4f}  "
                        f"CV_F1={np.mean(cv_f1_scores):.4f}±{np.std(cv_f1_scores):.4f}")

            if f1_w > best_f1:
                best_f1       = f1_w
                self.best_model = model
                self.best_name  = name

        # ── 4. Save best model ──────────────────────────────────────────────────
        os.makedirs(MODELS_PATH, exist_ok=True)
        joblib.dump(self.best_model, CLASSIFIER_PATH)
        logger.info(f"\n✓ Best classifier: {self.best_name} (F1={best_f1:.4f})")
        logger.info(f"  Saved → {CLASSIFIER_PATH}")

        # ── 5. Save metrics ─────────────────────────────────────────────────────
        self.metrics = {
            "best_model":  self.best_name,
            "best_f1":     best_f1,
            "feature_cols": feature_cols,
            "models":      results,
        }
        with open(CLASSIFIER_METRICS_PATH, "w") as f:
            json.dump(self.metrics, f, indent=2)
        logger.info(f"  Metrics saved → {CLASSIFIER_METRICS_PATH}")

        logger.info("\n✓ Classification training complete.")


if __name__ == "__main__":
    trainer = ClassificationTrainer()
    trainer.run()
