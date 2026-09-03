@echo off
setlocal EnableExtensions
title RATS V2.0 - New Server Setup
color 0B
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 goto elevate
goto admin_ready

:elevate
echo Requesting Administrator permission...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:admin_ready
echo ============================================================
echo       RATS V2.0 - NEW WINDOWS SERVER INSTALLATION
echo ============================================================
echo.
echo This installs the RATS host prerequisites and application.
echo Internet access is required only while Winget installs missing tools.
echo Runtime operation uses the isolated Equipment LAN.
echo.

where winget >nul 2>&1
if errorlevel 1 goto missing_winget

call :ensure_tool python Python.Python.3.11
if errorlevel 1 goto failed
call :ensure_tool node OpenJS.NodeJS.LTS
if errorlevel 1 goto failed
call :ensure_tool git Git.Git
if errorlevel 1 goto failed

set "PATH=%ProgramFiles%\nodejs;%LocalAppData%\Programs\Python\Python311;%LocalAppData%\Programs\Python\Python311\Scripts;%ProgramFiles%\Git\cmd;%PATH%"

echo.
echo [1/5] Installing Python packages...
python -m pip install --upgrade pip
if errorlevel 1 goto failed
python -m pip install -r requirement.txt
if errorlevel 1 goto failed

echo.
echo [2/5] Installing frontend packages...
pushd arc-system\client-shell
call npm install
if errorlevel 1 goto frontend_failed

echo.
echo [3/5] Building the production UI...
call npm run build
if errorlevel 1 goto frontend_failed
popd

echo.
echo [4/5] Creating server-only credentials...
if exist "rats_secrets.local.bat" goto secrets_exist
call :generate_secret RATS_OPERATOR_PASSWORD
call :generate_secret RATS_TECHNICIAN_PASSWORD
call :generate_secret RATS_ADMIN_PASSWORD
call :generate_secret RATS_DEVELOPER_PASSWORD
call :generate_secret RATS_PROXY_UPLOAD_TOKEN
call :generate_secret RATS_DEPLOY_TOKEN
(
  echo @echo off
  echo rem LOCAL SERVER SECRETS - NEVER COMMIT OR SHARE THIS FILE.
  echo set "RATS_OPERATOR_PASSWORD=%RATS_OPERATOR_PASSWORD%"
  echo set "RATS_TECHNICIAN_PASSWORD=%RATS_TECHNICIAN_PASSWORD%"
  echo set "RATS_ADMIN_PASSWORD=%RATS_ADMIN_PASSWORD%"
  echo set "RATS_DEVELOPER_PASSWORD=%RATS_DEVELOPER_PASSWORD%"
  echo set "RATS_PROXY_UPLOAD_TOKEN=%RATS_PROXY_UPLOAD_TOKEN%"
  echo set "RATS_DEPLOY_TOKEN=%RATS_DEPLOY_TOKEN%"
) > "rats_secrets.local.bat"
echo Created rats_secrets.local.bat with unique random values.
goto secrets_done

:secrets_exist
echo Existing rats_secrets.local.bat was preserved.

:secrets_done
echo.
echo [5/5] Configuring Windows Defender Firewall...
set "RATS_ALLOWED_REMOTE=LocalSubnet"
set /p RATS_ALLOWED_REMOTE="Allowed source IP/range for ports 3000 and 8080 [LocalSubnet]: "
if "%RATS_ALLOWED_REMOTE%"=="" set "RATS_ALLOWED_REMOTE=LocalSubnet"

netsh advfirewall firewall show rule name="ARC RATS Web UI" >nul 2>&1
if errorlevel 1 netsh advfirewall firewall add rule name="ARC RATS Web UI" dir=in action=allow protocol=TCP localport=3000 remoteip=%RATS_ALLOWED_REMOTE% profile=private
netsh advfirewall firewall show rule name="ARC RATS API" >nul 2>&1
if errorlevel 1 netsh advfirewall firewall add rule name="ARC RATS API" dir=in action=allow protocol=TCP localport=8080 remoteip=%RATS_ALLOWED_REMOTE% profile=private

echo.
echo ============================================================
echo SETUP COMPLETE
echo ============================================================
echo Secrets: rats_secrets.local.bat
echo Start:   start_production.bat
echo Stop:    stop_command_center.bat
echo.
echo Save the generated operator passwords in the approved password store.
echo Copy only the matching Recipe Bot and deployment tokens to equipment configs.
echo.
set "START_NOW=N"
set /p START_NOW="Start RATS now? [y/N]: "
if /I "%START_NOW%"=="Y" call start_production.bat
exit /b 0

:ensure_tool
where %~1 >nul 2>&1
if not errorlevel 1 goto tool_present
echo Installing %~2...
winget install --id %~2 --exact --accept-package-agreements --accept-source-agreements --silent
if errorlevel 1 exit /b 1
:tool_present
echo %~1 is available.
exit /b 0

:generate_secret
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "-join ((48..57)+(65..90)+(97..122) ^| Get-Random -Count 32 ^| ForEach-Object {[char]$_})"`) do set "%~1=%%S"
exit /b 0

:frontend_failed
popd
goto failed

:missing_winget
echo ERROR: Winget is not available on this Windows server.
echo Install Microsoft App Installer, then run this setup again.
pause
exit /b 1

:failed
echo.
echo ERROR: Setup did not complete. Review the message above, then rerun this file.
pause
exit /b 1
