param([string]$SourceDirectory, [string]$ZipPath)
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath $SourceDirectory -DestinationPath $ZipPath -CompressionLevel Optimal -WarningAction SilentlyContinue
