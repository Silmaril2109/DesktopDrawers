@echo off
cd /d "%~dp0"
start "DesktopDrawer" /min cmd /c "npm start > "%~dp0drawer.log" 2>&1"
