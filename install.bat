@echo off
REM docDocs Extension Installer for Windows
REM Double-click this file or run from CMD

powershell -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
pause
