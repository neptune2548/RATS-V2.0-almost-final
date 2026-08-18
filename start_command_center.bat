@echo off
TITLE ARC Industrial Command Center — Master Launcher v0.3
color 0B

echo.
echo  ======================================================================
echo  :          ARC INDUSTRIAL COMMAND CENTER v0.3 — Full Stack           :
echo  ======================================================================
echo.
echo  Starting all system microservices...
echo.
echo    [1] RATS SECS/GEM Engine          (Python FastAPI — Port 8080)
echo    [2] Section Manager               (SECS/GEM Connections — 15 Machines)
echo    [3] ARC Command Center UI         (React App     — Port 3000)
echo.
echo.
:: ── 1. RATS SECS/GEM Backend (Port 8080) ────────────────────────────────────
echo  [%TIME%] Starting RATS SECS/GEM Engine...
start "ARC — RATS SECS/GEM Engine (Port 8080)" /min cmd /c "cd /d "%~dp0arc-system\client-rats" && python main.py"
timeout /t 1 /nobreak >nul

:: ── 2. Section Manager (spawns 1 console per machine internally) ────────────
echo  [%TIME%] Starting Section Manager (SECS/GEM connections)...
start "ARC — Section Manager (Supervisor)" cmd /c "cd /d "%~dp0arc-system\section-manager" && python manager.py"
timeout /t 2 /nobreak >nul

:: ── 3. Open browser ONCE before starting dev server ─────────────────────────
echo  [%TIME%] Launching browser at http://localhost:3000 ...
start http://localhost:3000

:: ── 4. Check for node_modules and install if missing ────────────────────────
cd /d "%~dp0arc-system\client-shell"
if not exist "node_modules\" (
    echo  [%TIME%] Installing React dependencies, this may take a moment...
    call npm install
)

:: ── 5. React Frontend Dev Server (Port 3000) — stays in foreground ──────────
echo  [%TIME%] Starting ARC Command Center UI (React)...
echo.
echo  ══════════════════════════════════════════════════════════════════════
echo   All services launched. This window runs the React dev server.
echo   Close this window (or press Ctrl+C) to stop the UI server.
echo   Other services run in their own windows.
echo  ══════════════════════════════════════════════════════════════════════
echo.

cd /d "%~dp0arc-system\client-shell"
cmd /c npm run dev

pause
