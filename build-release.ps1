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
    'LICENSE', 'README.md', 'PRIVACY.md'
)
$taskFiles = @($taskNames | ForEach-Object {
    $taskPath = Join-Path $PSScriptRoot $_
    if (-not (Test-Path -LiteralPath $taskPath)) { throw "缺少发布文件：$_" }
    $taskPath
})
$taskOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $taskOutput -Force | Out-Null
$taskZip = Join-Path $taskOutput "system-font-substituter-v$taskVersion.zip"
Compress-Archive -LiteralPath $taskFiles -DestinationPath $taskZip -Force
$taskCSS = Join-Path $taskOutput 'apple-ui-mix.css'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'apple-ui-mix.css') -Destination $taskCSS -Force

# 通过 Windows 已知文件夹获取下载目录，支持用户重定向。
$taskShell = New-Object -ComObject Shell.Application
$taskDownloadFolder = $taskShell.Namespace('shell:Downloads')
if ($null -eq $taskDownloadFolder) { throw '无法取得 Windows 下载目录。' }
$taskDownloads = [Environment]::ExpandEnvironmentVariables($taskDownloadFolder.Self.Path)
$taskDownloadZip = Join-Path $taskDownloads ([System.IO.Path]::GetFileName($taskZip))
$taskDailyZip = Join-Path $taskDownloads 'system-font-substituter.zip'
Copy-Item -LiteralPath $taskZip -Destination $taskDownloadZip -Force
Copy-Item -LiteralPath $taskZip -Destination $taskDailyZip -Force
[pscustomobject]@{
    version = $taskVersion
    zip = $taskZip
    css = $taskCSS
    downloadZip = $taskDownloadZip
    dailyZip = $taskDailyZip
    sha256 = (Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
} | ConvertTo-Json
