#!/bin/bash
# docDocs Extension Installer
# Installs the extension to all VS Code-based IDEs (Code, Cursor, Windsurf, Kiro)
# Run from anywhere: ~/projects/docDocs/install.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VSIX_FILE="$SCRIPT_DIR/docdocs-0.1.0.vsix"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================="
echo "   docDocs Extension Installer"
echo "=========================================="
echo ""

# Rebuild if requested or if vsix doesn't exist
if [[ "$1" == "--rebuild" ]] || [[ ! -f "$VSIX_FILE" ]]; then
    echo -e "${YELLOW}Building extension...${NC}"
    cd "$SCRIPT_DIR"
    bun install
    bun run build
    bunx @vscode/vsce package --no-dependencies --allow-missing-repository 2>/dev/null
    echo -e "${GREEN}Build complete!${NC}"
    echo ""
fi

# Check if vsix exists
if [[ ! -f "$VSIX_FILE" ]]; then
    echo -e "${RED}Error: $VSIX_FILE not found${NC}"
    echo "Run with --rebuild to create it"
    exit 1
fi

# IDE CLI commands to try
declare -A IDE_CMDS=(
    ["VS Code"]="code"
    ["Cursor"]="cursor"
    ["Windsurf"]="windsurf"
    ["Kiro"]="kiro"
)

installed_count=0

for ide_name in "${!IDE_CMDS[@]}"; do
    cmd="${IDE_CMDS[$ide_name]}"

    if command -v "$cmd" &> /dev/null; then
        echo -n "Installing to $ide_name... "
        if $cmd --install-extension "$VSIX_FILE" --force &> /dev/null; then
            echo -e "${GREEN}Done${NC}"
            ((installed_count++))
        else
            echo -e "${RED}Failed${NC}"
        fi
    else
        echo -e "${YELLOW}$ide_name ($cmd) not found, skipping${NC}"
    fi
done

echo ""
echo "=========================================="
if [[ $installed_count -gt 0 ]]; then
    echo -e "${GREEN}Installed to $installed_count IDE(s)!${NC}"
    echo ""
    echo "Usage in your IDE:"
    echo "  Ctrl+Shift+P -> 'docdocs: Generate Documentation'"
    echo ""
    echo "Or right-click any file/folder in the explorer."
else
    echo -e "${RED}No IDEs found to install to.${NC}"
    echo "Make sure your IDE CLI is in PATH."
fi
echo "=========================================="

# Convenience: create symlink in ~/bin if it exists
if [[ -d "$HOME/bin" ]] && [[ ! -L "$HOME/bin/docdocs-install" ]]; then
    ln -sf "$SCRIPT_DIR/install.sh" "$HOME/bin/docdocs-install"
    echo ""
    echo "Tip: Run 'docdocs-install' from anywhere to reinstall"
fi
