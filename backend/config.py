"""
CFRP SHM Platform — Global Configuration
All paths, thresholds, and constants live here.
"""
import os

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR            = os.path.dirname(os.path.abspath(__file__))
DATA_RAW_PATH       = os.path.join(BASE_DIR, "data", "raw")
DATA_PROCESSED_PATH = os.path.join(BASE_DIR, "data", "processed")
MODELS_PATH         = os.path.join(BASE_DIR, "models")

# Ensure directories exist
for _p in [DATA_RAW_PATH, DATA_PROCESSED_PATH, MODELS_PATH]:
    os.makedirs(_p, exist_ok=True)

# ── Sensor / signal settings ───────────────────────────────────────────────────
N_SENSORS        = 16          # PZT piezoelectric channels
SIGNAL_LENGTH    = 1500        # samples per waveform capture
SAMPLE_RATE_KHZ  = 1200       # kHz — typical for Lamb wave experiments

# ── Damage state mapping ───────────────────────────────────────────────────────
DAMAGE_STATES = {
    0: "Healthy",
    1: "Early Damage",
    2: "Moderate Damage",
    3: "Severe Damage",
}
DAMAGE_COLORS = {
    0: "#10B981",   # green
    1: "#F59E0B",   # amber
    2: "#F97316",   # orange
    3: "#EF4444",   # red
}

# ── Cycle / lifecycle thresholds ───────────────────────────────────────────────
CYCLE_THRESHOLDS   = [0.25, 0.50, 0.75]   # fraction of total life per damage class
RUL_ALERT_THRESHOLD = 0.20                 # alert when < 20 % life remaining

# ── Train / eval settings ──────────────────────────────────────────────────────
RANDOM_STATE = 42
TEST_SIZE    = 0.20
CV_FOLDS     = 5

# ── Model file names ───────────────────────────────────────────────────────────
CLASSIFIER_PATH        = os.path.join(MODELS_PATH, "best_classifier.pkl")
REGRESSOR_PATH         = os.path.join(MODELS_PATH, "best_regressor.pkl")
SCALER_PATH            = os.path.join(MODELS_PATH, "scaler.pkl")
SHAP_BG_PATH           = os.path.join(MODELS_PATH, "shap_background.pkl")
CLASSIFIER_METRICS_PATH = os.path.join(MODELS_PATH, "classifier_metrics.json")
REGRESSOR_METRICS_PATH  = os.path.join(MODELS_PATH, "regressor_metrics.json")

# ── API ────────────────────────────────────────────────────────────────────────
API_HOST = "0.0.0.0"
API_PORT = 8000

# ── Composite panel catalogue (used when no .mat files present) ────────────────
PANEL_CATALOGUE = {
    "CFRP_IM7_8552_00":  {"material": "IM7/8552",    "layup": "[0/90/±45]₂s", "max_cycles": 18000},
    "CFRP_T300_5208_01": {"material": "T300/5208",   "layup": "[0/90]₄s",    "max_cycles": 15000},
    "CFRP_AS4_3501_02":  {"material": "AS4/3501-6",  "layup": "[±45]₄s",     "max_cycles": 20000},
    "CFRP_IM6_EPXY_03":  {"material": "IM6/Epoxy",   "layup": "[0/±30/90]s", "max_cycles": 12000},
}
