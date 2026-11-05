@echo off
setlocal
cd /d "%~dp0"
set "CAMPUSMATCH_NODE=E:\nodejs\node.exe"
if not exist "%CAMPUSMATCH_NODE%" set "CAMPUSMATCH_NODE=node"
"%CAMPUSMATCH_NODE%" "%~dp0scripts\start-local.mjs" %*
exit /b %errorlevel%
