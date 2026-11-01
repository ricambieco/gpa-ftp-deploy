# Build locale di una CANDIDATA: non modifica il repository o la CURRENT
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (Test-Path 'package-lock.json') { npm ci } else { npm install }
if ($LASTEXITCODE -ne 0) { throw 'Installazione dipendenze fallita' }
npm run compile
if ($LASTEXITCODE -ne 0) { throw 'Compilazione TypeScript fallita' }
npm test
if ($LASTEXITCODE -ne 0) { throw 'Test falliti' }
npx --yes @vscode/vsce package --out 'FTP-Deploy_v1.3.4_CANDIDATA.vsix'
if ($LASTEXITCODE -ne 0) { throw 'Packaging VSIX fallito' }
Write-Host 'VSIX CANDIDATA creata. Prima di promuovere a CURRENT eseguire il collaudo locale.'
