# docDocs Extension Installer for Windows
# Installs the extension to all VS Code-based IDEs (Code, Cursor, Windsurf, Kiro)
# Run from PowerShell: ~\projects\docDocs\install.ps1

param(
    [switch]$Rebuild
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VsixFile = Join-Path $ScriptDir "docdocs-0.1.0.vsix"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   docDocs Extension Installer" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Rebuild if requested or if vsix doesn't exist
if ($Rebuild -or !(Test-Path $VsixFile)) {
    Write-Host "Building extension..." -ForegroundColor Yellow
    Push-Location $ScriptDir

    # Try bun first, fall back to npm
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
        bun run build
        bunx @vscode/vsce package --no-dependencies --allow-missing-repository 2>$null
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
        npm run build
        npx @vscode/vsce package --no-dependencies --allow-missing-repository 2>$null
    } else {
        Write-Host "Error: Neither bun nor npm found. Please install one." -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Pop-Location
    Write-Host "Build complete!" -ForegroundColor Green
    Write-Host ""
}

# Check if vsix exists
if (!(Test-Path $VsixFile)) {
    Write-Host "Error: $VsixFile not found" -ForegroundColor Red
    Write-Host "Run with -Rebuild to create it"
    exit 1
}

# IDE CLI commands to try
$IDEs = @{
    "VS Code" = "code"
    "Cursor" = "cursor"
    "Windsurf" = "windsurf"
    "Kiro" = "kiro"
}

$InstalledCount = 0

foreach ($ide in $IDEs.GetEnumerator()) {
    $ideName = $ide.Key
    $cmd = $ide.Value

    # Check if command exists
    $cmdPath = Get-Command $cmd -ErrorAction SilentlyContinue

    if ($cmdPath) {
        Write-Host "Installing to $ideName... " -NoNewline
        try {
            & $cmd --install-extension $VsixFile --force 2>$null | Out-Null
            Write-Host "Done" -ForegroundColor Green
            $InstalledCount++
        } catch {
            Write-Host "Failed" -ForegroundColor Red
        }
    } else {
        Write-Host "$ideName ($cmd) not found, skipping" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan

if ($InstalledCount -gt 0) {
    Write-Host "Installed to $InstalledCount IDE(s)!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage in your IDE:"
    Write-Host "  Ctrl+Shift+P -> 'docdocs: Generate Documentation'"
    Write-Host ""
    Write-Host "Or right-click any file/folder in the explorer."
} else {
    Write-Host "No IDEs found to install to." -ForegroundColor Red
    Write-Host "Make sure your IDE CLI is in PATH."
    Write-Host ""
    Write-Host "To add to PATH, search 'Environment Variables' in Windows"
    Write-Host "and add your IDE's bin folder to the Path variable."
}

Write-Host "==========================================" -ForegroundColor Cyan
