#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Songscription launcher
#
# usage:  ./start.sh [desktop | web | package]
#
#   desktop  the app in its own window, with hot reload   (default)
#   web      the interface in a browser, no Rust needed
#   package  build both deliverables into release/ :
#            the one-click installer and the portable single exe
#
# First run installs dependencies. Everything after that is npm doing the work.
# ---------------------------------------------------------------------------

set -e

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required, and it is not on PATH."
  echo "Get it from https://nodejs.org and run this again."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies - first run only, this takes a minute."
  npm install
fi

MODE="${1:-desktop}"

case "$MODE" in
  web)
    echo "Opening the interface in your browser. No Rust toolchain needed."
    npm run dev
    ;;
  package)
    echo "Packaging the installer and the portable exe into release/."
    npm run package
    ;;
  desktop)
    echo "Starting Songscription in its own window."
    npm run desktop
    ;;
  *)
    echo "Unknown option: $MODE"
    echo "usage: ./start.sh [desktop | web | package]"
    exit 1
    ;;
esac
