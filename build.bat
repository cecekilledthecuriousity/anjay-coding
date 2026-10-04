@echo off
title TDS Static HTML Assembler
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build gagal. Silakan periksa pesan error di atas.
    pause
)
