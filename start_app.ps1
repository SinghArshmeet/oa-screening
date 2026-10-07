# OA-NER Screening: Unified App Launcher
param(
    [int]$BackendPort = 8001,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   OrthoNex OA-NER Screening - Full Stack Launcher        " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Start Backend in new window
Write-Host "[1/2] Launching Backend on port $BackendPort..." -ForegroundColor Green
$backendCmd = "-NoExit -Command `"Set-Location '$PSScriptRoot'; .\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port $BackendPort`""
Start-Process powershell -ArgumentList $backendCmd

# 2. Wait briefly for backend to initialize
Start-Sleep -Seconds 2

# 3. Start Frontend in new window
Write-Host "[2/2] Launching Vite Frontend on port $FrontendPort..." -ForegroundColor Green
$frontendDir = Join-Path $PSScriptRoot 'frontend'
$frontendCmd = "-NoExit -Command `"Set-Location '$frontendDir'; npm.cmd run dev`""
Start-Process powershell -ArgumentList $frontendCmd

Write-Host "`nAll services launched!" -ForegroundColor Green
Write-Host "Backend API:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor Yellow
Write-Host "Frontend App: http://localhost:$FrontendPort" -ForegroundColor Yellow
