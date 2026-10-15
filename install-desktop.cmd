@echo off
setlocal
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install Node.js 22 or newer, then run this installer again.
  pause
  exit /b 1
)
node "%~dp0scripts\install-desktop.mjs" %*
set "INSTALL_RESULT=%ERRORLEVEL%"
pause
exit /b %INSTALL_RESULT%
