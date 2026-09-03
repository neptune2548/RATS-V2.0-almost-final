@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\msys64\mingw32\bin;%PATH%"
set "MAKE=C:\msys64\mingw32\bin\mingw32-make.exe"
if not exist "%MAKE%" (
  echo ERROR: MinGW32 build tools were not found.
  exit /b 1
)
"%MAKE%" clean
if errorlevel 1 exit /b 1
"%MAKE%"
if errorlevel 1 exit /b 1
echo Built arc_deployment_receiver.exe for Windows XP x86.
