# Shared by backup.ps1 and restore.ps1: reads backend\.env into a hashtable and finds
# the PostgreSQL tools. Dot-source it:  . (Join-Path $PSScriptRoot 'env.ps1')
$backendDir = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $backendDir '.env'
if (-not (Test-Path $envFile)) { throw "backend\.env is missing (copy .env.example and fill it in)." }

$config = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)\s*$') { $config[$Matches[1]] = $Matches[2] }
}
$dbHost = if ($config.DB_HOST) { $config.DB_HOST } else { 'localhost' }
$dbPort = if ($config.DB_PORT) { $config.DB_PORT } else { '5432' }
$dbName = if ($config.DB_NAME) { $config.DB_NAME } else { 'plan_tracker' }

# Newest installed PostgreSQL's bin folder (pg_dump/pg_restore must be at least the server's version).
$pgBin = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory |
    Sort-Object { [int]($_.Name -replace '\D', '') } -Descending |
    Select-Object -First 1 | ForEach-Object { Join-Path $_.FullName 'bin' }
if (-not $pgBin) { throw 'PostgreSQL tools not found in C:\Program Files\PostgreSQL.' }

# The owner role: it owns the tables, so it can dump and recreate them.
# PGPASSWORD passes the password to pg_dump without putting it on the command line.
$env:PGPASSWORD = $config.PLAN_OWNER_PASSWORD
