#!/bin/bash
# docDocs Extension Installer - WSL + Windows
# Installs to all IDEs on both WSL and Windows side
# Usage: docdocs-install (or ~/projects/docDocs/install-all.sh)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "====== Installing to WSL ======"
"$SCRIPT_DIR/install.sh" "$@"

echo ""
echo "====== Installing to Windows ======"
WIN_PATH=$(wslpath -w "$SCRIPT_DIR/install.ps1")
powershell.exe -ExecutionPolicy Bypass -File "$WIN_PATH" "$@"

echo ""
echo "All done! Extension ready in all IDEs (WSL + Windows)"
