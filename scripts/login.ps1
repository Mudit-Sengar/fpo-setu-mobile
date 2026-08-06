# Drive the login screen: fill username/password, pick a role, submit.
# Assumes the app is already showing the login screen at the emulator's native
# 1080x2400. Verification-only helper — the app has no test hooks.
#
#   .\scripts\login.ps1 -User farmer01 -Pass farmer -Role farmer
param(
  [Parameter(Mandatory = $true)][string]$User,
  [Parameter(Mandatory = $true)][string]$Pass,
  [Parameter(Mandatory = $true)][ValidateSet("farmer", "fpo", "buyer")][string]$Role
)

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$roleX = @{ farmer = 245; fpo = 540; buyer = 835 }[$Role]

# Clear both fields first so the helper is safe to call twice in a row.
& $adb shell input tap 540 905
Start-Sleep -Milliseconds 900
1..30 | ForEach-Object { & $adb shell input keyevent 67 } | Out-Null
& $adb shell input text $User
Start-Sleep -Milliseconds 500

& $adb shell input tap 540 1093
Start-Sleep -Milliseconds 900
1..30 | ForEach-Object { & $adb shell input keyevent 67 } | Out-Null
& $adb shell input text $Pass
Start-Sleep -Milliseconds 500

& $adb shell input tap $roleX 1314
Start-Sleep -Milliseconds 700

# Hide the keyboard: it covers the Login button.
& $adb shell input keyevent 4
Start-Sleep -Milliseconds 1000

& $adb shell input tap 540 1490
Start-Sleep -Milliseconds 4000
"submitted $User / $Role"
