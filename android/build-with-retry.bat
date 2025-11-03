@echo off
setlocal enabledelayedexpansion
set MAX_RETRIES=3
set RETRY_COUNT=0
set BUILD_SUCCESS=0

:retry_build
echo [Build] Attempt %RETRY_COUNT% of %MAX_RETRIES%

call gradlew.bat --stop >nul 2>&1
timeout /t 2 /nobreak >nul

call gradlew.bat app:installDebug -PreactNativeDevServerPort=8081 %*
set BUILD_EXIT_CODE=%ERRORLEVEL%

if %BUILD_EXIT_CODE% equ 0 (
    echo [Build] Success!
    set BUILD_SUCCESS=1
    goto end
)

echo [Build] Failed with exit code %BUILD_EXIT_CODE%
set /a RETRY_COUNT+=1

if %RETRY_COUNT% lss %MAX_RETRIES% (
    echo [Build] Cleaning dependencies-accessors and retrying...
    if exist ".gradle\8.10.2\dependencies-accessors" (
        rd /s /q ".gradle\8.10.2\dependencies-accessors" 2>nul
    )
    timeout /t 3 /nobreak >nul
    goto retry_build
)

:end
if %BUILD_SUCCESS% equ 0 (
    echo [Build] Failed after %MAX_RETRIES% attempts
    exit /b %BUILD_EXIT_CODE%
)

exit /b 0

