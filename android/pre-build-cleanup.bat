@echo off
echo [Cleanup] Stopping all Gradle daemons...
call gradlew.bat --stop >nul 2>&1

echo [Cleanup] Stopping Java processes that might hold locks...
rem Only kill Java if it's holding Gradle processes (be careful not to kill other Java apps)
wmic process where "name='java.exe' and commandline like '%%gradle%%'" delete >nul 2>&1

echo [Cleanup] Waiting for file locks to release...
timeout /t 3 /nobreak >nul

echo [Cleanup] Cleaning dependencies-accessors folder completely...
if exist ".gradle\8.10.2\dependencies-accessors" (
    echo [Cleanup] Attempting to remove dependencies-accessors...
    
    rem Try to delete the specific problematic folder first
    if exist ".gradle\8.10.2\dependencies-accessors\569c8b261a8a714d7731d5f568e0e5c05babae10" (
        echo [Cleanup] Removing specific folder...
        rd /s /q ".gradle\8.10.2\dependencies-accessors\569c8b261a8a714d7731d5f568e0e5c05babae10" 2>nul
        timeout /t 1 /nobreak >nul
    )
    
    rem Delete temp folders
    for /d %%d in (".gradle\8.10.2\dependencies-accessors\569c8b261a8a714d7731d5f568e0e5c05babae10-*") do (
        if exist "%%d" (
            echo [Cleanup] Removing temp folder...
            rd /s /q "%%d" 2>nul
        )
    )
    
    rem Finally try to delete entire folder
    echo [Cleanup] Removing entire dependencies-accessors folder...
    rd /s /q ".gradle\8.10.2\dependencies-accessors" 2>nul
    
    rem Wait and retry if still exists
    if exist ".gradle\8.10.2\dependencies-accessors" (
        echo [Cleanup] Warning: Folder still exists. Waiting longer...
        timeout /t 2 /nobreak >nul
        taskkill /F /IM java.exe >nul 2>&1
        rd /s /q ".gradle\8.10.2\dependencies-accessors" 2>nul
    )
)

echo [Cleanup] Done! Ready to build.
