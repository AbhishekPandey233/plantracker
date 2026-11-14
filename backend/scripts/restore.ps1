# Restores a backup made by backup.ps1. REPLACES everything in the target database.
#   .\backend\scripts\restore.ps1                         pick from the list, restore into plan_tracker
#   .\backend\scripts\restore.ps1 -File <path.dump>       restore that file
#   .\backend\scripts\restore.ps1 -Database <other_db>    restore into another database (to test a backup)
# Stop the backend first, so nothing writes during the restore.
param([string]$File, [string]$Database)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')
if (-not $Database) { $Database = $dbName }

if (-not $File) {
    $dumps = @(Get-ChildItem (Join-Path $backendDir 'backups') -Filter 'plan_tracker-*.dump' | Sort-Object Name -Descending)
    if ($dumps.Count -eq 0) { throw 'No backups in backend\backups. Run backup.ps1 first.' }
    for ($i = 0; $i -lt $dumps.Count; $i++) { Write-Host "  [$i] $($dumps[$i].Name)" }
    $choice = Read-Host 'Number of the backup to restore'
    $File = $dumps[[int]$choice].FullName
}
if (-not (Test-Path $File)) { throw "Not found: $File" }

Write-Host "This replaces ALL data in database '$Database' with $File." -ForegroundColor Yellow
if ((Read-Host "Type the database name ($Database) to continue") -ne $Database) {
    Write-Host 'Cancelled, nothing changed.'
    exit 1
}

try {
    # --clean --if-exists: drop each table before recreating it from the dump.
    # --single-transaction: if anything fails, the database stays exactly as it was.
    & (Join-Path $pgBin 'pg_restore.exe') -h $dbHost -p $dbPort -U plan_owner -d $Database --clean --if-exists --single-transaction $File
    if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (exit code $LASTEXITCODE); nothing was changed." }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
Write-Host "Restored $File into $Database." -ForegroundColor Green
