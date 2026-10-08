$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$appVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$tauriVersion = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
$cargoVersion = (Select-String -LiteralPath src-tauri/Cargo.toml -Pattern '^version = "([^"]+)"' | Select-Object -First 1).Matches.Groups[1].Value
if ($appVersion -ne $tauriVersion -or $appVersion -ne $cargoVersion) { throw 'Version mismatch' }
function Run-Checked([string]$Tool, [string[]]$Arguments) {
    & $Tool @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Tool failed: $LASTEXITCODE" }
}
Run-Checked npm.cmd @('ci')
Run-Checked npm.cmd @('test')
Run-Checked npm.cmd @('run','lint')
Run-Checked cargo @('fmt','--manifest-path','src-tauri/Cargo.toml','--','--check')
Run-Checked cargo @('test','--manifest-path','src-tauri/Cargo.toml','--locked')
Run-Checked cargo @('clippy','--manifest-path','src-tauri/Cargo.toml','--locked','--all-targets','--','-D','warnings')
Run-Checked npm.cmd @('run','tauri','build','--','--no-bundle')
Run-Checked node @('scripts/package.mjs')
