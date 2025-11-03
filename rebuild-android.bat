@echo off
echo ========================================
echo Rebuilding Android app with native module
echo ========================================
echo.

echo Step 1: Cleaning Android build...
cd android
call gradlew.bat clean
if %errorlevel% neq 0 (
    echo ERROR: Clean failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Building and installing app...
cd ..
call npm run android
if %errorlevel% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Rebuild completed successfully!
echo AssetCopyModule should now be available.
echo ========================================
pause

