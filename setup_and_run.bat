@echo off
REM ============================================================
REM CFRP SHM Platform — One-Click Setup & Launch
REM Run this script as Administrator from the project root.
REM ============================================================
setlocal enabledelayedexpansion

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   CFRP Structural Health Monitoring Platform         ║
echo  ║   Setup and Launch Script                           ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

REM ── 1. Check Python ──────────────────────────────────────────
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.9+ from https://python.org
    pause & exit /b 1
)
echo [OK] Python found.

REM ── 2. Check Node.js ─────────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org
    pause & exit /b 1
)
echo [OK] Node.js found.

REM ── 3. Install Python ML dependencies ───────────────────────
echo.
echo [STEP 1/5] Installing Python ML dependencies...
pip install numpy scipy pandas scikit-learn xgboost shap joblib --quiet
if %errorlevel% neq 0 (
    echo [ERROR] pip install failed. Check your Python/pip installation.
    pause & exit /b 1
)
echo [OK] Python packages installed.

REM ── 4. Generate synthetic CFRP data ─────────────────────────
echo.
echo [STEP 2/5] Generating synthetic CFRP dataset...
cd /d "%~dp0backend"
python src\simulate.py
if %errorlevel% neq 0 (
    echo [ERROR] Data generation failed.
    pause & exit /b 1
)
echo [OK] Synthetic data generated.

REM ── 5. Train ML models ───────────────────────────────────────
echo.
echo [STEP 3/5] Training damage classifier (RF + XGBoost + GBT + SVC)...
python src\train_classifier.py
if %errorlevel% neq 0 (
    echo [ERROR] Classifier training failed.
    pause & exit /b 1
)
echo [OK] Classifier trained.

echo.
echo [STEP 3b]   Training RUL regressor (RF + XGBoost + GBT)...
python src\train_regressor.py
if %errorlevel% neq 0 (
    echo [ERROR] Regressor training failed.
    pause & exit /b 1
)
echo [OK] Regressor trained.

REM ── 6. Install Node.js backend deps ─────────────────────────
echo.
echo [STEP 4/5] Installing Node.js backend dependencies...
cd /d "%~dp0backend"
npm install --silent
if %errorlevel% neq 0 (
    echo [ERROR] Backend npm install failed.
    pause & exit /b 1
)
echo [OK] Backend packages installed.

REM ── 7. Install frontend deps ─────────────────────────────────
echo.
echo [STEP 5/5] Installing frontend dependencies...
cd /d "%~dp0frontend"
npm install --silent
if %errorlevel% neq 0 (
    echo [ERROR] Frontend npm install failed.
    pause & exit /b 1
)
echo [OK] Frontend packages installed.

REM ── 8. Launch ────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║   Setup Complete! Launching servers...              ║
echo  ║                                                     ║
echo  ║   Frontend  → http://localhost:5173                ║
echo  ║   Backend   → http://localhost:5001                ║
echo  ║                                                     ║
echo  ║   Open http://localhost:5173 in your browser       ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

REM Start Express backend in a new window
start "CFRP-SHM Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"

REM Small delay so backend starts first
timeout /t 3 /nobreak >nul

REM Start Vite frontend in a new window
start "CFRP-SHM Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [OK] Both servers started. Check the opened terminal windows.
echo      Press any key to exit this setup window.
pause
endlocal
