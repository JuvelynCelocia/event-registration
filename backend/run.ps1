# API server for the Event Registration App.
#
# PHP's bundled pdo_sqlite/sqlite3 extensions are not enabled in php.ini on this
# machine, so they are enabled per-process here. Nothing global is changed.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$php = (Get-Command php -ErrorAction SilentlyContinue).Source
if (-not $php) {
    Write-Error 'PHP was not found on PATH.'
}

$extensions = Join-Path (Split-Path $php) 'ext'
$port = if ($env:PORT) { $env:PORT } else { '8000' }

Write-Host "Event Registration API running at http://127.0.0.1:$port/api" -ForegroundColor Green
Write-Host 'Press Ctrl+C to stop.' -ForegroundColor DarkGray

& $php `
    -d "extension_dir=$extensions" `
    -d extension=pdo_sqlite `
    -d extension=sqlite3 `
    -S "127.0.0.1:$port" `
    -t "$root\public" `
    "$root\public\index.php"
