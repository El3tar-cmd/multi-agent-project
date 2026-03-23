# ============================================================
# Multi-Agent AI Platform - Startup Script (Windows PowerShell)
# ============================================================
# This script starts both the back-end API server and the
# front-end Vite dev server in parallel.
#
# Prerequisites:
#   - Node.js (v20+)
#   - pnpm (v10+)
#   - Ollama running locally (default: http://localhost:11434)
#
# Usage:
#   .\start.ps1
# ============================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  NEXUS.AI - Multi-Agent Platform" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ------ Step 1: Check prerequisites ------
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js is not installed!" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "  pnpm:    v$pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: pnpm is not installed! Run: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# Check Ollama
try {
    [void](Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 3 -ErrorAction Stop)
    Write-Host "  Ollama:  Online" -ForegroundColor Green
} catch {
    Write-Host "  Ollama:  Offline (start Ollama for LLM features)" -ForegroundColor DarkYellow
}

# ------ Step 2: Install dependencies ------
Write-Host ""
Write-Host "[2/5] Installing dependencies..." -ForegroundColor Yellow
Set-Location $ROOT
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: pnpm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Dependencies installed." -ForegroundColor Green

# ------ Step 3: Build native modules ------
Write-Host ""
Write-Host "[3/5] Building native modules..." -ForegroundColor Yellow
$betterSqlitePath = Join-Path $ROOT "node_modules\.pnpm\better-sqlite3@12.8.0\node_modules\better-sqlite3"
$bindingPath = Join-Path $betterSqlitePath "build\Release\better_sqlite3.node"

if (-not (Test-Path $bindingPath)) {
    Write-Host "  Compiling better-sqlite3 native addon..." -ForegroundColor DarkYellow
    Push-Location $betterSqlitePath
    npm run install 2>$null
    Pop-Location
    Write-Host "  Native module compiled." -ForegroundColor Green
} else {
    Write-Host "  Native modules already built." -ForegroundColor Green
}

# ------ Step 4: Build API Server ------
Write-Host ""
Write-Host "[4/5] Building API server..." -ForegroundColor Yellow
Push-Location (Join-Path $ROOT "artifacts\api-server")
node ./build.mjs
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: API server build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  API server built." -ForegroundColor Green

# ------ Step 5: Start servers ------
Write-Host ""
Write-Host "[5/5] Starting servers..." -ForegroundColor Yellow
Write-Host ""

$env:PORT = "3001"

# Start API server in the background
$apiJob = Start-Job -ScriptBlock {
    param($root)
    Set-Location $root
    $env:PORT = "3001"
    node --enable-source-maps ./artifacts/api-server/dist/index.mjs 2>&1
} -ArgumentList $ROOT

# Give the API server a moment to start
Start-Sleep -Seconds 3

# Clear PORT so Vite uses its default (5173)
Remove-Item Env:\PORT -ErrorAction SilentlyContinue

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers are starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  API Server:  http://localhost:3001" -ForegroundColor White
Write-Host "  Front-end:   http://localhost:5173" -ForegroundColor White
Write-Host "  Ollama:      http://localhost:11434" -ForegroundColor White
Write-Host ""
Write-Host "  Press Ctrl+C to stop all servers." -ForegroundColor DarkGray
Write-Host ""

# Start front-end in the foreground
try {
    Set-Location $ROOT
    pnpm --filter @workspace/ai-platform run dev
} finally {
    # Clean up the background API job when the user presses Ctrl+C
    Write-Host ""
    Write-Host "Shutting down servers..." -ForegroundColor Yellow
    Stop-Job -Job $apiJob -ErrorAction SilentlyContinue
    Remove-Job -Job $apiJob -Force -ErrorAction SilentlyContinue
    Write-Host "All servers stopped." -ForegroundColor Green
}
