@echo off
echo ========================================
echo Generate Release Keystore
echo ========================================
echo.
echo This script will help you create a release keystore for signing your Android app.
echo.
echo IMPORTANT: Keep the keystore file and passwords safe!
echo If you lose the keystore, you will NOT be able to update your app on Google Play Store.
echo.
echo.

set /p KEYSTORE_ALIAS="Enter keystore alias (default: constructpro-key): "
if "%KEYSTORE_ALIAS%"=="" set KEYSTORE_ALIAS=constructpro-key

set /p KEYSTORE_PASSWORD="Enter keystore password (min 6 characters): "
if "%KEYSTORE_PASSWORD%"=="" (
    echo ERROR: Keystore password cannot be empty!
    pause
    exit /b 1
)

set /p KEY_PASSWORD="Enter key password (default: same as keystore password): "
if "%KEY_PASSWORD%"=="" set KEY_PASSWORD=%KEYSTORE_PASSWORD%

set KEYSTORE_PATH=app\release.keystore

echo.
echo Generating keystore...
echo Alias: %KEYSTORE_ALIAS%
echo Keystore file: %KEYSTORE_PATH%
echo.
echo NOTE: For PKCS12 keystore, store password and key password must be the same.
echo.

REM PKCS12 doesn't support different passwords, so we only use -storepass
REM Also add -dname to avoid interactive prompts
keytool -genkeypair -v -storetype PKCS12 -keystore %KEYSTORE_PATH% -alias %KEYSTORE_ALIAS% -keyalg RSA -keysize 2048 -validity 10000 -storepass %KEYSTORE_PASSWORD% -dname "CN=ConstructPro, OU=Mobile, O=ConstructPro, L=City, ST=State, C=VN"

if %ERRORLEVEL% neq 0 (
echo.
    echo ERROR: Failed to generate keystore!
    echo Make sure Java JDK is installed and keytool is in your PATH.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Keystore created successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Copy android/keystore.properties.example to android/keystore.properties
echo 2. Fill in the keystore information in keystore.properties
echo    (Use the SAME password for both MYAPP_RELEASE_STORE_PASSWORD and MYAPP_RELEASE_KEY_PASSWORD)
echo 3. DO NOT commit keystore.properties or release.keystore to git!
echo.
echo Keystore information to save:
echo   Alias: %KEYSTORE_ALIAS%
echo   Keystore file: %KEYSTORE_PATH%
echo   Keystore password: %KEYSTORE_PASSWORD%
echo   Key password: %KEYSTORE_PASSWORD% (same as keystore password for PKCS12)
echo.
echo IMPORTANT: Save this information in a secure location!
echo.
pause

