[CmdletBinding()]
param(
    [string]$OutputDirectory = ''
)

$ErrorActionPreference = 'Stop'
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot 'dist' }
$taskManifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$taskVersion = $taskManifest.version
if ($taskVersion -notmatch '^\d+\.\d+\.\d+(?:\.\d+)?$') {
    throw "manifest.json 中的版本无效：$taskVersion"
}

# 显式列出发布文件，避免将测试、缓存或 Git 元数据加入安装包。
$taskNames = @(
    'manifest.json', 'background.js', 'shared.js', 'content.js', 'apple-ui-mix.css',
    'options.html', 'options.css', 'options.js', 'icons', '_locales',
    'LICENSE', 'README.md', 'CHANGELOG.md', 'PRIVACY.md'
)
$taskFiles = @($taskNames | ForEach-Object {
    $taskPath = Join-Path $PSScriptRoot $_
    if (-not (Test-Path -LiteralPath $taskPath)) { throw "缺少发布文件：$_" }
    $taskPath
})
$taskOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskZip = Join-Path $taskOutput "system-font-substituter-v$taskVersion.zip"

# 显式使用 ZIP 标准的 / 路径；PowerShell 5.1 的 Compress-Archive 会
# 仅规范化中央目录，留下带反斜杠的本地文件头，导致 Edge 拖入安装失败。
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$taskRoot = [System.IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$taskStream = [System.IO.File]::Open($taskZip, [System.IO.FileMode]::Create)
$taskArchive = $null
try {
    $taskArchive = New-Object System.IO.Compression.ZipArchive($taskStream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    foreach ($taskPath in $taskFiles) {
        $taskItem = Get-Item -LiteralPath $taskPath
        $taskEntries = if ($taskItem.PSIsContainer) {
            @(Get-ChildItem -LiteralPath $taskPath -File -Recurse | Sort-Object FullName)
        } else { @($taskItem) }
        foreach ($taskEntry in $taskEntries) {
            $taskEntryName = $taskEntry.FullName.Substring($taskRoot.Length).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $taskArchive, $taskEntry.FullName, $taskEntryName, [System.IO.Compression.CompressionLevel]::Optimal
            ) | Out-Null
        }
    }
} finally {
    if ($null -ne $taskArchive) { $taskArchive.Dispose() }
    $taskStream.Dispose()
}
$taskCSS = Join-Path $taskOutput 'apple-ui-mix.css'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'apple-ui-mix.css') -Destination $taskCSS -Force

# 通过 Windows 已知文件夹获取下载目录，支持用户重定向。
$taskShell = New-Object -ComObject Shell.Application
$taskDownloadFolder = $taskShell.Namespace('shell:Downloads')
if ($null -eq $taskDownloadFolder) { throw '无法取得 Windows 下载目录。' }
$taskDownloads = [Environment]::ExpandEnvironmentVariables($taskDownloadFolder.Self.Path)
$taskDownloadZip = Join-Path $taskDownloads ([System.IO.Path]::GetFileName($taskZip))
Copy-Item -LiteralPath $taskZip -Destination $taskDownloadZip -Force
[pscustomobject]@{
    version = $taskVersion
    zip = $taskZip
    css = $taskCSS
    downloadZip = $taskDownloadZip
    sha256 = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json
