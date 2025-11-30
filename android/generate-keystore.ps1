# PowerShell wrapper for generate-keystore.bat
# This script ensures the batch file runs correctly in PowerShell

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$batchFile = Join-Path $scriptPath "generate-keystore.bat"

# Run the batch file using cmd.exe
& cmd /c $batchFile

