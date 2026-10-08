$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path $PSScriptRoot -Parent)
$runtimeVersion = '154.0.4258.62'
$officialUrl = 'https://msedge.sf.dl.delivery.mp.microsoft.com/filestreamingservice/files/b92cd7d9-6976-4f34-9708-47e80937c287/Microsoft.WebView2.FixedVersionRuntime.154.0.4258.62.x64.cab'
$expectedSha = 'E8F55A4BDE27C7F82512402B56A58539B5EC8928BE4E500E077B6F66C9EF4668'
New-Item -ItemType Directory -Force build/downloads | Out-Null
$cabPath = Join-Path (Get-Location) 'build/downloads/webview2.cab'
if (!(Test-Path -LiteralPath $cabPath)) { Invoke-WebRequest -Uri $officialUrl -OutFile $cabPath }
if ((Get-FileHash -LiteralPath $cabPath -Algorithm SHA256).Hash -ne $expectedSha) { throw 'CAB SHA-256 mismatch; file preserved' }
$runtimePath = Join-Path (Get-Location) "build/runtime/Microsoft.WebView2.FixedVersionRuntime.$runtimeVersion.x64"
if (!(Test-Path -LiteralPath $runtimePath)) {
    New-Item -ItemType Directory -Force build/runtime | Out-Null
    & expand.exe $cabPath '-F:*' (Join-Path (Get-Location) 'build/runtime')
    if ($LASTEXITCODE -ne 0) { throw 'CAB expansion failed' }
}
$signature = Get-AuthenticodeSignature -LiteralPath (Join-Path $runtimePath 'msedgewebview2.exe')
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'O=Microsoft Corporation') { throw 'Microsoft signature verification failed' }
Invoke-WebRequest -Uri 'https://developer.microsoft.com/microsoft-edge/api/eula/webview2?locale=en-us&fixed=true' -OutFile build/downloads/webview2-eula.json
Write-Output "Verified official Fixed Runtime $runtimeVersion; read its terms before use or redistribution."
