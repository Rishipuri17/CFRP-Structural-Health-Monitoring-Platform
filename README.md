# CFRP Structural Health Monitoring Platform

> **Production-grade MERN + Python ML platform** for fatigue damage detection in Carbon Fibre Reinforced Polymer composites using Lamb wave ultrasonic signals from 16 PZT sensors.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite 5 · Tailwind CSS 3 · Recharts · Framer Motion |
| Backend API | Node.js 20 · Express 4 · Mongoose |
| Database | MongoDB (stores panel metadata & prediction history) |
| ML Pipeline | Python 3.10+ · scikit-learn · XGBoost · SHAP · scipy |
| Data | NASA-convention `.mat` files (synthetic or real NASA CFRP) |
| DevOps | Docker Compose · Nginx |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React (Vite) frontend   :5173                          │
│  Recharts · Framer Motion · Tailwind CSS                │
└──────────────────┬──────────────────────────────────────┘
                   │  /api/*  (proxy via Vite dev)
┌──────────────────▼──────────────────────────────────────┐
│  Express.js API Server   :5001                          │
│  ├── /api/panels         Panel listing & metadata       │
│  ├── /api/signal         Raw waveform signals           │
│  ├── /api/ml             Classify · RUL · SHAP          │
│  └── /api/train          SSE training pipeline trigger  │
│                                                         │
│  MongoDB (Mongoose)  — panels + prediction history      │
└──────────────────┬──────────────────────────────────────┘
                   │  child_process.spawn()
┌──────────────────▼──────────────────────────────────────┐
│  Python ML Engine   (src/infer.py)                      │
│  ├── simulate.py          Synthetic .mat data generator │
│  ├── data_loader.py       NASA .mat file parser         │
│  ├── feature_extractor.py 288 time/freq features        │
│  ├── preprocessor.py      Labels · RUL · scaling        │
│  ├── train_classifier.py  RF · XGBoost · GBT · SVC      │
│  ├── train_regressor.py   RF · XGBoost · GBT            │
│  └── explainer.py         SHAP TreeExplainer / Kernel   │
└─────────────────────────────────────────────────────────┘
```

---

## Features

### 6 Application Pages

| Page | Route | Description |
|---|---|---|
| Landing | `/` | 60fps canvas CFRP fiber weave · animated counters · CTA |
| Coupon Selector | `/select` | 4-panel grid with material badges · life bars · detail sidebar |
| Signal Explorer | `/signals` | Multi-channel Lamb wave waveforms · cycle scrubber · sensor heatmap |
| Damage Classifier | `/classify` | 4-class damage state · confidence gauge · confusion matrix · CV metrics |
| RUL Predictor | `/rul` | Predicted remaining cycles · trajectory chart with CI band · health bar |
| SHAP Insights | `/shap` | Global feature importance · custom SVG waterfall · sortable table |
| Training Pipeline | `/train` | One-click training with SSE live log stream · model comparison table |

### ML Models

**Damage Classification (4 classes):**
- Healthy (0–25% life)
- Early Damage (25–50% life)  
- Moderate Damage (50–75% life)
- Severe Damage (75–100% life)

Models: `RandomForest` · `XGBoost` · `GradientBoosting` · `SVC`  
Metric: Weighted F1 (5-fold Stratified CV)

**RUL Regression:**  
Models: `RandomForest` · `XGBoost` · `GradientBoosting`  
Metric: RMSE (5-fold KFold CV)

**Explainability:**  
`SHAP TreeExplainer` for tree-based models · `KernelExplainer` for SVC  
Global importance · per-sample waterfall decomposition

---

## Quick Start (First Time)

### Prerequisites
- **Python 3.9+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **MongoDB** running locally on `mongodb://localhost:27017` — [mongodb.com](https://www.mongodb.com/try/download/community)
- **pip** (comes with Python)

### Option A: One-Click Setup (Windows)

```batch
# From the cfrp-shm-platform directory:
setup_and_run.bat
```

This script:
1. Installs all Python ML packages
2. Generates synthetic CFRP dataset (240 `.mat` files)
3. Trains all classifiers + regressors
4. Installs Node.js dependencies (backend + frontend)
5. Launches both servers in separate windows

### Option B: Manual Setup

```bash
# 1. Python ML dependencies
pip install numpy scipy pandas scikit-learn xgboost shap joblib

# 2. Generate synthetic data
cd backend
python src/simulate.py

# 3. Train models (~2–4 min)
python src/train_classifier.py
python src/train_regressor.py

# 4. Install Node.js dependencies
npm install
cd ../frontend && npm install

# 5. Start backend (in one terminal)
cd backend && npm run dev

# 6. Start frontend (in another terminal)
cd frontend && npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Using Real NASA Data

1. Download: https://phm-datasets.s3.amazonaws.com/NASA/2.+Composites.zip
2. Extract `.mat` files into `backend/data/raw/`
3. Skip `simulate.py` — `DataLoader` auto-detects real files
4. Re-run training: `python src/train_classifier.py && python src/train_regressor.py`

---

## Docker (Production)

```bash
docker compose up --build
```

Services:
- `mongo` — MongoDB on port 27017
- `api` — Express + Python on port 5001
- `frontend` — Nginx on port 80

---

## Project Structure

```
cfrp-shm-platform/
├── backend/
│   ├── src/
│   │   ├── simulate.py          Synthetic data generator
│   │   ├── data_loader.py       .mat file parser
│   │   ├── feature_extractor.py 288 signal features
│   │   ├── preprocessor.py      Labels · RUL · scaling
│   │   ├── train_classifier.py  Classification training
│   │   ├── train_regressor.py   Regression training
│   │   ├── explainer.py         SHAP explainability
│   │   ├── evaluate.py          Metrics utilities
│   │   └── infer.py             Python inference CLI
│   ├── routes/
│   │   ├── panels.js            Panel listing/metadata
│   │   ├── signals.js           Waveform endpoints
│   │   ├── ml.js                ML inference endpoints
│   │   └── train.js             SSE training pipeline
│   ├── models/
│   │   ├── Panel.js             Mongoose panel schema
│   │   └── Prediction.js        Mongoose prediction schema
│   ├── data/raw/                .mat files (generated or real)
│   ├── models/                  Trained .pkl + .json artifacts
│   ├── config.py                Global constants
│   ├── server.js                Express entry point
│   ├── db.js                    MongoDB connection
│   ├── pythonBridge.js          Node→Python child_process bridge
│   └── requirements.txt         Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/client.js        Centralised API client
│   │   ├── components/          Reusable UI components
│   │   └── pages/               6 application pages
│   ├── index.html               HTML entry point
│   └── vite.config.js           Vite config with API proxy
├── docker-compose.yml
├── setup_and_run.bat            One-click Windows setup
└── start.bat                    Quick launch (after setup)
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/panels` | List all panels |
| GET | `/api/panels/:id/metadata` | Panel metadata |
| GET | `/api/signal/:id?cycle=N&channel=0-15` | Single channel waveform |
| GET | `/api/signal/:id/all?cycle=N` | All 16 channel waveforms |
| POST | `/api/ml/:id/classify?cycle=N` | Damage classification |
| POST | `/api/ml/:id/rul?cycle=N` | RUL prediction |
| GET | `/api/ml/:id/shap?cycle=N` | SHAP values |
| GET | `/api/ml/performance` | Trained model metrics |
| GET | `/api/ml/:id/history` | MongoDB prediction history |
| POST | `/api/train` | Trigger training (SSE stream) |
| GET | `/api/health` | Health check |

---

## Environment Variables

### Backend (`.env`)
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/cfrp_shm
PYTHON_PATH=python
NODE_ENV=development
```

---

*Built with React · Express · MongoDB · Python · scikit-learn · XGBoost · SHAP*
