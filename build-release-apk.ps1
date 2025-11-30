# PowerShell wrapper for build-release-apk.bat
# This script ensures the batch file runs correctly in PowerShell

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$batchFile = Join-Path $scriptPath "build-release-apk.bat"

# Change to script directory and run the batch file using cmd.exe
# Use /c with quoted path to avoid parsing issues
Set-Location $scriptPath
cmd /c "`"$batchFile`""

