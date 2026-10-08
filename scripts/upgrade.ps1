param([Parameter(Mandatory)][string]$PackageDirectory, [Parameter(Mandatory)][string]$TargetDirectory)
$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path -LiteralPath $PackageDirectory).Path
$targetRoot = (Resolve-Path -LiteralPath $TargetDirectory).Path
foreach ($rootPath in @($packageRoot, $targetRoot)) {
    if ((Get-Item -LiteralPath $rootPath).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Root reparse point rejected' }
}
foreach ($manifestPath in @((Join-Path $packageRoot 'release.json'), (Join-Path $targetRoot 'release.json'))) {
    if ((Test-Path -LiteralPath $manifestPath) -and ((Get-Item -LiteralPath $manifestPath).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Manifest reparse point rejected' }
}
if ($packageRoot -eq $targetRoot) { throw 'Source and destination must differ' }
$manifest = Get-Content -LiteralPath (Join-Path $packageRoot 'release.json') -Raw | ConvertFrom-Json
$targetExe = Join-Path $targetRoot 'vrm-explorer.exe'
if (Get-Process -Name 'vrm-explorer' -ErrorAction SilentlyContinue) { throw 'Close VRM Explorer before upgrading / 請先關閉程式' }
foreach ($file in $manifest.files) {
    if ($file.path -notmatch '^(vrm-explorer\.exe|upgrade\.ps1|docs/[^/]+|licenses/[^/]+|runtime/webview2/.+)$' -or $file.path -match '(^|/)\.\.(/|$)') { throw 'Unsafe manifest path' }
    $source = [IO.Path]::GetFullPath((Join-Path $packageRoot $file.path))
    $destination = [IO.Path]::GetFullPath((Join-Path $targetRoot $file.path))
    if (!$source.StartsWith($packageRoot + [IO.Path]::DirectorySeparatorChar) -or !$destination.StartsWith($targetRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Path escapes root' }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $file.sha256) { throw "Checksum mismatch: $($file.path)" }
    # Reject existing reparse components before copying.
    $cursor = Split-Path $destination -Parent
    while ($cursor.Length -ge $targetRoot.Length) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Target contains a reparse point' }
        if ($cursor -eq $targetRoot) { break }; $cursor = Split-Path $cursor -Parent
    }
    if ((Test-Path -LiteralPath $destination) -and ((Get-Item -LiteralPath $destination).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Target file is a reparse point' }
}
if (Test-Path -LiteralPath $targetExe) { Copy-Item -LiteralPath $targetExe -Destination ($targetExe + '.before-upgrade-' + [DateTime]::UtcNow.Ticks) }
foreach ($file in $manifest.files) {
    $destination = Join-Path $targetRoot $file.path
    New-Item -ItemType Directory -Force -Path (Split-Path $destination -Parent) | Out-Null
    Copy-Item -LiteralPath (Join-Path $packageRoot $file.path) -Destination $destination -Force
}
Copy-Item -LiteralPath (Join-Path $packageRoot 'release.json') -Destination (Join-Path $targetRoot 'release.json') -Force
Write-Output 'Upgrade complete; data preserved / 升級完成，data 保留。'
