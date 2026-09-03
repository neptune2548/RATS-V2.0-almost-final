@echo off
echo Starting ARC Recipe Bot...
echo.
echo The bot runs as a system tray application and listens for the RATS host
echo on the authenticated file channel configured in config.ini.
echo Right-click the tray icon to quit.
echo.

set SCRIPT_DIR=%~dp0
start "" "%SCRIPT_DIR%secs_proxy_bot.exe"
