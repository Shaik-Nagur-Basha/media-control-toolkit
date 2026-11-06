@echo off
setlocal enabledelayedexpansion
title Media Control Toolkit - 1-Click Updater
echo ===================================================
echo     Media Control Toolkit - 1-Click Auto Updater   
echo ===================================================
echo.

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$repo = 'Shaik-Nagur-Basha/media-control-toolkit';" ^
  "$targetDir = (Get-Location).Path;" ^
  "Write-Host '[1/3] Checking for latest update on GitHub...' -ForegroundColor Cyan;" ^
  "$updated = $false;" ^
  "try {" ^
  "  if (Test-Path '.git') {" ^
  "    Write-Host 'Git repository detected. Attempting git pull...' -ForegroundColor Gray;" ^
  "    $gitRes = git pull origin main 2>&1;" ^
  "    if ($LASTEXITCODE -eq 0) {" ^
  "      Write-Host 'Successfully updated via git pull!' -ForegroundColor Green;" ^
  "      $updated = $true;" ^
  "    }" ^
  "  }" ^
  "  if (-not $updated) {" ^
  "    $releaseUrl = 'https://api.github.com/repos/' + $repo + '/releases/latest';" ^
  "    $release = Invoke-RestMethod -Uri $releaseUrl -Headers @{ 'User-Agent' = 'MCT-Updater' };" ^
  "    $tag = $release.tag_name;" ^
  "    Write-Host ('Latest release found: ' + $tag) -ForegroundColor Green;" ^
  "    $zipAsset = $release.assets | Where-Object { $_.name -like '*.zip' } | Select-Object -First 1;" ^
  "    $downloadUrl = if ($zipAsset) { $zipAsset.browser_download_url } else { $release.zipball_url };" ^
  "    $tempZip = Join-Path $env:TEMP 'mct-update.zip';" ^
  "    Write-Host ('[2/3] Downloading release ' + $tag + '...') -ForegroundColor Cyan;" ^
  "    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing;" ^
  "    Write-Host '[3/3] Extracting files into extension folder...' -ForegroundColor Cyan;" ^
  "    Add-Type -AssemblyName System.IO.Compression.FileSystem;" ^
  "    $zip = [System.IO.Compression.ZipFile]::OpenRead($tempZip);" ^
  "    foreach ($entry in $zip.Entries) {" ^
  "      if ($entry.FullName.EndsWith('/')) { continue; }" ^
  "      $entryPath = $entry.FullName;" ^
  "      if ($entryPath -match '^[^\/]+\/(.+)$') { $entryPath = $matches[1]; }" ^
  "      $destPath = Join-Path $targetDir $entryPath;" ^
  "      $destDir = Split-Path $destPath -Parent;" ^
  "      if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null; }" ^
  "      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destPath, $true);" ^
  "    }" ^
  "    $zip.Dispose();" ^
  "    Remove-Item $tempZip -Force -ErrorAction SilentlyContinue;" ^
  "    Write-Host 'Files extracted and updated successfully!' -ForegroundColor Green;" ^
  "  }" ^
  "  Write-Host '';" ^
  "  Write-Host '===================================================' -ForegroundColor Green;" ^
  "  Write-Host ' SUCCESS: Extension files updated to latest version! ' -ForegroundColor Green;" ^
  "  Write-Host '===================================================' -ForegroundColor Green;" ^
  "  Write-Host '';" ^
  "  Write-Host 'Opening chrome://extensions in Chrome...' -ForegroundColor Cyan;" ^
  "  Start-Process 'chrome.exe' 'chrome://extensions';" ^
  "  Write-Host '';" ^
  "  Write-Host '>> ACTION REQUIRED IN CHROME:' -ForegroundColor Yellow;" ^
  "  Write-Host '   Click the Reload (circle arrow) icon on Media Control Toolkit' -ForegroundColor Yellow;" ^
  "  Write-Host '   at chrome://extensions to activate the new version!' -ForegroundColor Yellow;" ^
  "} catch {" ^
  "  Write-Host ('Error updating: ' + $_.Exception.Message) -ForegroundColor Red;" ^
  "}"

echo.
pause
