@echo off
rem ---------------------------------------------------------------------------
rem Songscription launcher
rem
rem usage:  start.bat [desktop | web | build]
rem
rem   desktop  the app in its own window, with hot reload   (default)
rem   web      the interface in a browser, no Rust needed
rem   build    produce an installer under src-tauri\target\release\bundle\
rem
rem First run installs dependencies. Everything after that is npm doing the work.
rem ---------------------------------------------------------------------------

setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20 or newer is required, and it is not on PATH.
  echo Get it from https://nodejs.org and run this again.
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies - first run only, this takes a minute.
  call npm install
  if errorlevel 1 (
    echo The install failed. See the message above.
    exit /b 1
  )
)

set MODE=%1
if "%MODE%"=="" set MODE=desktop

if /i "%MODE%"=="web" (
  echo Opening the interface in your browser. No Rust toolchain needed.
  call npm run dev
) else if /i "%MODE%"=="build" (
  echo Building the installer into src-tauri\target\release\bundle\.
  call npm run desktop:build
) else if /i "%MODE%"=="desktop" (
  echo Starting Songscription in its own window.
  call npm run desktop
) else (
  echo Unknown option "%MODE%".
  echo usage: start.bat [desktop ^| web ^| build]
  exit /b 1
)

endlocal
