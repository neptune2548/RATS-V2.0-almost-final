@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist "rats_secrets.local.bat" goto already_configured

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

echo.
echo ============================================================
echo RATS SERVER LOGIN CREATED
echo ============================================================
echo Username: operator
echo Password: %RATS_OPERATOR_PASSWORD%
echo.
echo Save this password in the approved password store now.
echo The server-only secret file is: rats_secrets.local.bat
echo ============================================================
goto finish

:already_configured
echo RATS server secrets already exist. No values were changed.
echo Open rats_secrets.local.bat in Notepad on this server to view the role passwords.

:finish
if /I "%~1"=="--quiet" exit /b 0
echo.
pause
exit /b 0

:generate_secret
for /f "usebackq delims=" %%S in (`powershell -NoProfile -Command "-join ((48..57)+(65..90)+(97..122) ^| Get-Random -Count 32 ^| ForEach-Object {[char]$_})"`) do set "%~1=%%S"
exit /b 0
