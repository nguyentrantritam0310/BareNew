@echo off
echo ========================================
echo Building Release AAB (Google Play Store)
echo ========================================

REM Check if keystore.properties exists
if not exist android\keystore.properties (
    echo ERROR: keystore.properties not found!
    echo.
    echo You MUST create a release keystore before building for Google Play Store.
    echo.
    echo Steps:
    echo   1. Run: android\generate-keystore.bat
    echo   2. Copy android\keystore.properties.example to android\keystore.properties
    echo   3. Fill in your keystore information
    echo   4. Run this script again
    echo.
    pause
    exit /b 1
)

echo [1/6] Clearing Metro bundler cache...
call npx react-native start --reset-cache --no-interactive >nul 2>&1
timeout /t 2 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/6] Cleaning Android build cache...
cd android
if exist app\build (
    rd /s /q app\build
)
if exist build (
    rd /s /q build
)
call gradlew.bat clean
if %ERRORLEVEL% neq 0 (
    echo ERROR: Clean failed!
    exit /b 1
)

echo [3/6] Cleaning old bundle files...
cd ..
if exist android\app\src\main\assets (
    del /q android\app\src\main\assets\index.android.bundle >nul 2>&1
    del /q android\app\src\main\assets\index.android.bundle.meta >nul 2>&1
)

echo [4/6] Creating fresh JavaScript bundle...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --reset-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: Bundle creation failed!
    exit /b 1
)

echo [5/6] Building Release AAB...
cd android
call gradlew.bat bundleRelease
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo AAB location:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo.
echo File size:
for %%A in (app\build\outputs\bundle\release\app-release.aab) do echo   %%~zA bytes
echo.
echo Next steps:
echo   1. Upload the AAB file to Google Play Console
echo   2. Complete the app listing information
echo   3. Submit for review
echo.
pause

