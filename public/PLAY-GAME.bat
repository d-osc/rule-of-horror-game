@echo off
rem Rule of Horror - play the game from this folder without installing anything.
rem Extract the WHOLE folder from the zip first, then double-click this file.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0game-server.ps1"
pause
