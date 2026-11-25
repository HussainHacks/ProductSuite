$ErrorActionPreference = "Stop"
Write-Host "Running Ruff lint & format check..." -ForegroundColor Cyan
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .

Write-Host "Running Pytest..." -ForegroundColor Cyan
.\.venv\Scripts\pytest.exe

Write-Host "Running Frontend typecheck, tests, and builds..." -ForegroundColor Cyan
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
Write-Host "All checks passed!" -ForegroundColor Green
