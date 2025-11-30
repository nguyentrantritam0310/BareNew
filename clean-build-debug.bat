@echo off
echo ========================================
echo Clean Build Debug APK
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
if exist app\.cxx (
    rd /s /q app\.cxx
)
if exist .cxx (
    rd /s /q .cxx
)
if exist .build-cache (
    rd /s /q .build-cache
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
call npx react-native bundle --platform android --dev true --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res --reset-cache
if %ERRORLEVEL% neq 0 (
    echo ERROR: Bundle creation failed!
    pause
    exit /b 1
)

echo [Step 6/6] Building Debug APK...
cd android
echo Running Gradle build with stacktrace enabled for better error messages...
call gradlew.bat assembleDebug --stacktrace
if %ERRORLEVEL% neq 0 (
    echo.
    echo ========================================
    echo ERROR: Build failed!
    echo ========================================
    echo.
    echo Check the error messages above for details.
    echo Common issues:
    echo - Path length too long (Windows limitation)
    echo - Insufficient memory
    echo - File permission issues
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Debug APK built with latest code!
echo ========================================
echo.
echo APK location:
echo   %CD%\app\build\outputs\apk\debug\app-debug.apk
echo.
cd ..
pause

