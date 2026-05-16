@echo off
:: Run this file as Administrator to open port 3000 for the Android device
:: Right-click this file → "Run as administrator"

echo Adding Windows Firewall rule for port 3000...
netsh advfirewall firewall add rule name="Node Backend 3000" dir=in action=allow protocol=TCP localport=3000 profile=any

if %errorlevel% == 0 (
    echo.
    echo SUCCESS! Port 3000 is now open.
    echo.
    echo On your Android phone open Chrome and go to:
    echo   http://172.20.10.2:3000/health
    echo.
    echo You should see: {"status":"ok"}
    echo If it works, rebuild your Flutter app with: flutter clean ^&^& flutter run
) else (
    echo.
    echo FAILED. Make sure you right-clicked and chose "Run as administrator".
)

pause
