param(
    [int]$Port = 0
)

$ErrorActionPreference = 'Stop'

Set-Location $PSScriptRoot

$python = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    throw 'Project virtual environment not found. Create it with: py -m venv .venv'
}

# Determine port: default to 8000, fallback to 8001 if 8000 is occupied by another service
if ($Port -eq 0) {
    $existing8000 = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if ($existing8000) {
        try {
            $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/health' -TimeoutSec 1
            if ($health.status -eq 'ok') {
                Write-Host 'OA-NER backend is already running at http://127.0.0.1:8000'
                Write-Host 'API docs: http://127.0.0.1:8000/docs'
                exit 0
            }
            $Port = 8001
        } catch {
            Write-Host 'Port 8000 is occupied by another service. Falling back to port 8001...' -ForegroundColor Yellow
            $Port = 8001
        }
    } else {
        $Port = 8000
    }
}

$existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($existing) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 1
        if ($health.status -eq 'ok') {
            Write-Host "OA-NER backend is already running at http://127.0.0.1:$Port"
            Write-Host "API docs: http://127.0.0.1:$Port/docs"
            exit 0
        }
    } catch {
        # Already handled
    }
}

Write-Host "Starting OA-NER Screening Backend at http://127.0.0.1:$Port..."
& $python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port $Port

