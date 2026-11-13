# Starts the Plan Tracker: the backend (FastAPI) and the frontend (Vite), each in its
# own PowerShell window. Close a window (or press Ctrl+C in it) to stop that part.
# Run from anywhere:  .\start-dev.ps1
# ($PSScriptRoot is the folder this script is in, so the paths work from anywhere.)

$backend = Join-Path $PSScriptRoot 'backend'
$frontend = Join-Path $PSScriptRoot 'frontend'

if (-not (Test-Path (Join-Path $frontend '.env.local'))) {
    Write-Host 'frontend\.env.local is missing: copy frontend\.env.example and paste API_KEY from backend\.env.' -ForegroundColor Red
    exit 1
}

# -NoExit keeps each window open, so errors stay readable.
Start-Process powershell -WorkingDirectory $backend -ArgumentList '-NoExit', '-Command',
    '$Host.UI.RawUI.WindowTitle = ''Plan Tracker backend''; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload'
Start-Process powershell -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command',
    '$Host.UI.RawUI.WindowTitle = ''Plan Tracker frontend''; npm run dev'

Write-Host 'Started. Open http://localhost:5173 once both windows are ready.' -ForegroundColor Green
