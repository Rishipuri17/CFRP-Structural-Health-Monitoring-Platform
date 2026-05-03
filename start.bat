@echo off
REM Quick launch script — assumes setup has already been run
setlocal

echo.
echo [CFRP-SHM] Starting servers...
echo.

start "CFRP-SHM Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 2 /nobreak >nul
start "CFRP-SHM Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [OK] Backend  → http://localhost:5001
echo [OK] Frontend → http://localhost:5173
echo.
pause
endlocal
