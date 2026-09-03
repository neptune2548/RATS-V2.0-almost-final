@echo off
echo ============================================================
echo   ARC Recipe Bot — Build Script
echo   Target: Windows XP x86 (32-bit), fully static .exe
echo   Compiler: MinGW-w64 i686 (C:/msys64/mingw32)
echo ============================================================
echo.

set SCRIPT_DIR=%~dp0
set MINGW32=C:\msys64\mingw32\bin
set PATH=%MINGW32%;%PATH%
set MAKE=%MINGW32%\mingw32-make.exe

if not exist "%MINGW32%\g++.exe" (
    echo ERROR: MinGW32 g++ not found at %MINGW32%
    echo Please install MSYS2 from https://www.msys2.org/ and run:
    echo   pacman -S mingw-w64-i686-gcc
    pause
    exit /b 1
)

echo Compiler found: %MINGW32%\g++.exe
echo.

REM Check for make
if not exist "%MAKE%" (
    set MAKE=%MINGW32%\make.exe
)
if not exist "%MAKE%" (
    echo ERROR: mingw32-make.exe not found in %MINGW32%
    pause
    exit /b 1
)

echo Running make...
echo.

cd /d "%SCRIPT_DIR%"
"%MAKE%" -f Makefile

if errorlevel 1 (
    echo.
    echo ============================================================
    echo   BUILD FAILED. See errors above.
    echo ============================================================
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   BUILD SUCCESS!
echo   Output: %SCRIPT_DIR%secs_proxy_bot.exe
echo.
echo   To deploy to Equipment PC:
echo     1. Copy secs_proxy_bot.exe  to Equipment PC
echo     2. Copy config.ini          to same folder
echo     3. Edit config.ini (set machine_id and watch_dir)
echo     4. Run start_recipe_bot.bat (or double-click the .exe)
echo ============================================================
echo.
pause
