# dev-run.ps1 — run this instead of `flutter run` during development
# Re-enables the package if stealth mode disabled it, sets up ADB reverse, then launches.

$pkg = "com.parentalmonitor.child.debug"
$adb = "C:\Users\acer\AppData\Local\Android\sdk\platform-tools\adb.exe"

Write-Host "Re-enabling package (no-op if already enabled)..." -ForegroundColor Cyan
& $adb shell pm enable $pkg 2>$null

Write-Host "Setting up ADB reverse (port 3000)..." -ForegroundColor Cyan
& $adb reverse tcp:3000 tcp:3000

Write-Host "Launching app..." -ForegroundColor Green
flutter run --dart-define=BACKEND_URL=http://localhost:3000
