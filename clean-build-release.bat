@echo off
echo ========================================
echo Clean Build Release APK
echo ========================================
echo.

echo [Step 1/6] Stopping Metro bundler and Node processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [Step 2/6] Clearing Metro cache...
if exist node_modules\.cache (
    rd /s /q node_modules\.cache
)
if exist .metro (
    rd /s /q .metro
)

echo [Step 3/6] Cleaning Android build folders...
cd android
if exist app\build (
    rd /s /q app\build
)
if exist build (
    rd /s /q build
)
call gradlew.bat clean
cd ..

echo [Step 4/6] Removing old bundle...
if exist android\app\src\main\assets\index.android.bundle (
    del /q android\app\src\main\assets\index.android.bundle
)
if exist android\app\src\main\assets\index.android.bundle.meta (
    del /q android\app\src\main\assets\index.android.bundle.meta
)

echo [Step 5/6] Creating fresh JavaScript bundle with latest code...
call npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --reset-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: Bundle creation failed!
    pause
    exit /b 1
)

echo [Step 6/6] Building Release APK...
cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% neq 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! APK built with latest code!
echo ========================================
echo.
echo APK location:
echo   %CD%\app\build\outputs\apk\release\app-release.apk
echo.
cd ..
pause

