# Start local user-space PostgreSQL used by this project's .env (port 5433).
# Binaries: C:\Users\skaiw\pgsql\pgsql
# Data:     C:\Users\skaiw\pgdata-adviser

$ErrorActionPreference = "Stop"
$pgBin = "C:\Users\skaiw\pgsql\pgsql\bin"
$pgData = "C:\Users\skaiw\pgdata-adviser"
$pgLog = "C:\Users\skaiw\pgdata-adviser\log.txt"
$port = 5433

$env:Path = "$pgBin;$env:Path"

$ready = & pg_isready -h 127.0.0.1 -p $port 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "PostgreSQL already running on port $port"
  exit 0
}

if (-not (Test-Path "$pgData\PG_VERSION")) {
  Write-Error "Data directory missing: $pgData. Re-run local DB setup."
}

Write-Host "Starting PostgreSQL on port $port..."
& pg_ctl -D $pgData -l $pgLog -o "-p $port" start
Start-Sleep -Seconds 2
& pg_isready -h 127.0.0.1 -p $port
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed. Last log lines:"
  Get-Content $pgLog -Tail 30
  exit 1
}
Write-Host "OK — DATABASE_URL uses 127.0.0.1:$port/adviser_db"
