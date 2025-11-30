# PowerShell wrapper for build-release-aab.bat
# This script ensures the batch file runs correctly in PowerShell

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$batchFile = Join-Path $scriptPath "build-release-aab.bat"

# Run the batch file using cmd.exe
& cmd /c $batchFile

