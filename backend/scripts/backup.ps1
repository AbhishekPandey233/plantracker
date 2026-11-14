# Daily backup: dumps the whole plan_tracker database into
#   backend\backups\plan_tracker-YYYY-MM-DD.dump   (Kathmandu date)
# and keeps only the newest 14. Run from anywhere:  .\backend\scripts\backup.ps1
# Running it twice on one day replaces that day's file.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'env.ps1')

$backups = Join-Path $backendDir 'backups'
New-Item -ItemType Directory -Force $backups | Out-Null

$tz = [TimeZoneInfo]::FindSystemTimeZoneById('Nepal Standard Time')  # Asia/Kathmandu
$today = [TimeZoneInfo]::ConvertTime([DateTime]::UtcNow, $tz).ToString('yyyy-MM-dd')
$file = Join-Path $backups "plan_tracker-$today.dump"

try {
    # -Fc: PostgreSQL's compressed "custom" format, which pg_restore reads.
    & (Join-Path $pgBin 'pg_dump.exe') -h $dbHost -p $dbPort -U plan_owner -d $dbName -Fc -f $file
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit code $LASTEXITCODE)" }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

# Keep the newest 14 dumps, delete older ones.
Get-ChildItem $backups -Filter 'plan_tracker-*.dump' | Sort-Object Name -Descending |
    Select-Object -Skip 14 | Remove-Item

Write-Host "Backup saved: $file" -ForegroundColor Green
