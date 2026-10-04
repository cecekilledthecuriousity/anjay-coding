@echo off
title TDS Local Web Server
echo Memulai TDS Local Web Server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Gagal menjalankan local server.
    pause
)
