$ErrorActionPreference = "Stop"

Write-Host "Running Ruff lint & format check..." -ForegroundColor Cyan
.\.venv\Scripts\ruff.exe check .
.\.venv\Scripts\ruff.exe format --check .

Write-Host "Running Shared Auth Pytest..." -ForegroundColor Cyan
.\.venv\Scripts\pytest.exe packages/authentication/tests -v

$apps = @("formforge", "taskforge", "planforge", "bookforge", "dataforge", "boardforge", "storyforge")
foreach ($app in $apps) {
    Write-Host "Running Pytest for $app..." -ForegroundColor Cyan
    $env:PYTHONPATH = "apps/$app/backend"
    .\.venv\Scripts\pytest.exe "apps/$app/backend/tests" -v
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
Remove-Item Env:PYTHONPATH -ErrorAction SilentlyContinue

Write-Host "Running Frontend typecheck, tests, and builds..." -ForegroundColor Cyan
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
Write-Host "All ecosystem checks passed!" -ForegroundColor Green
