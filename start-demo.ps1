param([int]$Port = 1231)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 24 or newer.' }
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 24) { throw 'RoomQu demo requires Node.js 24 or newer.' }
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) { throw 'Run npm install or pnpm install in RoomQu first.' }
$env:ROOMQU_MODE = 'integrated'
& node node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port $Port --strictPort
exit $LASTEXITCODE
