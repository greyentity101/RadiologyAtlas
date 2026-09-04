@echo off
REM Generate Android Release Keystore for Google Play Store Submission
REM This keystore is used to digitally sign your Android App Bundle (.aab)

echo ========================================================
echo   Generating Release Keystore for Radiology Atlas
echo ========================================================

set KEYSTORE_NAME=radiologyatlas-release.jks
set ALIAS=radiologyatlas
set VALIDITY_DAYS=10000

echo Creating keystore: %KEYSTORE_NAME% with alias: %ALIAS%
echo Please keep your password safe. You will need it to publish app updates.
echo.

set KEYTOOL_CMD=keytool
if exist "C:\Program Files\Microsoft\jdk-21.0.12.1-hotspot\bin\keytool.exe" (
    set "KEYTOOL_CMD=C:\Program Files\Microsoft\jdk-21.0.12.1-hotspot\bin\keytool.exe"
)

"%KEYTOOL_CMD%" -genkeypair -v -keystore "%KEYSTORE_NAME%" -alias "%ALIAS%" -keyalg RSA -keysize 2048 -validity %VALIDITY_DAYS% -storetype PKCS12

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo Keystore generated successfully: %KEYSTORE_NAME%
    echo Path: %~dp0%KEYSTORE_NAME%
    echo ========================================================
) else (
    echo.
    echo Failed to generate keystore. Ensure Java JDK is installed and keytool is in PATH.
)

pause
