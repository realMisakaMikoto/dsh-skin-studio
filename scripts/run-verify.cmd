@echo off
setlocal
cd /d "%~dp0.."
call npm.cmd run verify > "%~dp0..\.test-out.txt" 2>&1
exit /b %ERRORLEVEL%
