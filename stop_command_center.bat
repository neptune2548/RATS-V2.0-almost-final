@echo off
TITLE ARC Command Center — Shutdown
color 0C

echo.
echo  ======================================================================
echo  :               SHUTTING DOWN ALL ARC MICROSERVICES                  :
echo  ======================================================================
echo.

echo  Killing RATS SECS/GEM Engine...
powershell -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -match 'main\.py' -and $_.CommandLine -match 'python' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo  Killing Section Manager and ALL hidden ghost workers...
powershell -Command "Get-WmiObject Win32_Process | Where-Object { ($_.CommandLine -match 'manager\.py' -or $_.CommandLine -match 'worker\.py') -and $_.CommandLine -match 'python' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo  Killing React Frontend Server...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo  ✅ All services have been successfully shut down!
echo.
echo  Cleaning up all terminal windows...
:: Target specifically the windows launched by the start script
taskkill /F /FI "WINDOWTITLE eq ARC — *" /T >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq ARC Industrial Command Center*" /T >nul 2>&1
