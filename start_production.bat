@echo off
TITLE ARC Production Server
color 0A
cd /d "%~dp0"

if exist "%~dp0rats_secrets.local.bat" call "%~dp0rats_secrets.local.bat"

for %%V in (RATS_OPERATOR_PASSWORD RATS_TECHNICIAN_PASSWORD RATS_ADMIN_PASSWORD RATS_DEVELOPER_PASSWORD RATS_PROXY_UPLOAD_TOKEN RATS_DEPLOY_TOKEN) do (
    if not defined %%V (
        echo ERROR: %%V is not configured.
        echo Copy rats_secrets.local.bat.example to rats_secrets.local.bat and set unique values.
        pause
        exit /b 1
    )
)

echo =======================================================
echo         ARC SYSTEM - PRODUCTION SERVER STARTUP
echo =======================================================
echo.
echo To allow other computers to access this dashboard, we need
echo this computer's IP address (for example: 192.168.1.50).
echo.
echo (If you don't know it, open a new command prompt and type 'ipconfig' to find your IPv4 Address).
echo.
set /p SERVER_IP="Enter this computer's IP address (or press Enter to just use localhost): "

if "%SERVER_IP%"=="" set SERVER_IP=127.0.0.1

echo.
echo [1/4] Configuring Frontend for Production...
echo The frontend will use the IP or hostname opened in the operator's browser.

echo.
echo [2/4] Building Frontend UI...
cd arc-system\client-shell
call npm run build
cd ..\..

echo.
echo [3/4] Starting Backend Services...
:: Set environment variables for production
set RATS_HOST=0.0.0.0
set RATS_PORT=8080
set RATS_CORS_ORIGINS=http://%SERVER_IP%:3000,http://localhost:3000
set RATS_RELOAD=false

start "ARC - Production Backend (Port 8080)" /min cmd /c "cd arc-system\client-rats && python main.py"
timeout /t 2 /nobreak >nul

start "ARC - SECS/GEM Section Manager" /min cmd /c "cd arc-system\section-manager && python manager.py"
timeout /t 2 /nobreak >nul

echo.
echo [4/4] Starting Web Server (Port 3000)...
echo =======================================================
echo.
echo   SUCCESS! The ARC Command Center is now running.
echo.
echo   Operators on other PCs can access it by going to:
echo   http://%SERVER_IP%:3000
echo.
echo   Keep this window open to keep the website online.
echo   Press Ctrl+C to stop the server.
echo =======================================================
echo.
cd arc-system\client-shell
call npm run preview -- --host 0.0.0.0 --port 3000 --strictPort
