param([string]$SourceDirectory,[string]$ZipPath,[string]$EntriesPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$updateRoot = (Resolve-Path -LiteralPath $SourceDirectory).Path
$entries = Get-Content -LiteralPath $EntriesPath -Raw | ConvertFrom-Json
$stream = [IO.File]::Open($ZipPath,[IO.FileMode]::CreateNew)
try {
    $archive = [IO.Compression.ZipArchive]::new($stream,[IO.Compression.ZipArchiveMode]::Create,$true)
    try { foreach ($entry in $entries) {
        if ($entry -match '(^|/)\.\.(/|$)' -or $entry -match '[\\:]') { throw 'Unsafe ZIP entry' }
        $source = [IO.Path]::GetFullPath((Join-Path $updateRoot $entry))
        if (!$source.StartsWith($updateRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'ZIP entry outside stage' }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$source,$entry,[IO.Compression.CompressionLevel]::Optimal) | Out-Null
    } } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
