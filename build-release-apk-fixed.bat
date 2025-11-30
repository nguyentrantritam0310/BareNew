@echo off
echo ========================================
echo Building Release APK
echo ========================================
REM Check if keystore.properties exists
if not exist android\keystore.properties (
    echo WARNING: keystore.properties not found!
    echo The app will be signed with debug keystore (NOT for production).
    echo.
    echo To create a release keystore:
    echo   1. Run: android\generate-keystore.bat
    echo   2. Copy android\keystore.properties.example to android\keystore.properties
    echo   3. Fill in your keystore information
    echo.
    pause
)

echo [1/5] Clearing Metro bundler cache...
call npx react-native start --reset-cache --no-interactive >nul 2>&1
timeout /t 2 /nobreak >nul
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [2/5] Cleaning Android build cache...
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

echo [3/5] Cleaning old bundle files...
cd ..
if exist android\app\src\main\assets (
    del /q android\app\src\main\assets\index.android.bundle >nul 2>&1
    del /q android\app\src\main\assets\index.android.bundle.meta >nul 2>&1
)

echo [4/5] Creating fresh JavaScript bundle...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --reset-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: Bundle creation failed!
    exit /b 1
)

echo [5/5] Building Release APK...
cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed!
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
echo APK location:
echo   android\app\build\outputs\apk\release\app-release.apk
echo.
echo File size:
for %%A in (app\build\outputs\apk\release\app-release.apk) do echo   %%~zA bytes
echo.
echo You can install this APK on Android devices.
echo.
pause


