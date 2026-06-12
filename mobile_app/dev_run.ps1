# dev_run.ps1 — Use this instead of 'flutter run' during development.
# Automatically re-enables the launcher alias if it was disabled during hide-icon testing,
# then starts flutter run with the correct backend URL.

param(
    [string]$Device    = "10BF9424CR001A9",
    [string]$Backend   = "http://localhost:3000"
)

$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "[1/3] Re-enabling app alias (safe no-op if already enabled)..." -ForegroundColor Cyan
& $adb -s $Device shell am start -n "com.parentalmonitor.child.debug/com.parentalmonitor.child.MainActivity" | Out-Null
Start-Sleep -Seconds 2

Write-Host "[2/3] Setting up USB port forwarding..." -ForegroundColor Cyan
& $adb -s $Device reverse tcp:3000 tcp:3000 | Out-Null

Write-Host "[3/3] Starting flutter run..." -ForegroundColor Cyan
flutter run --dart-define="BACKEND_URL=$Backend"
