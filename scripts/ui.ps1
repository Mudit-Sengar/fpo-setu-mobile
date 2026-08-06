# Drive the running app on the emulator/device for visual verification.
#
#   .\scripts\ui.ps1 restart              force-stop + relaunch (picks up a new bundle)
#   .\scripts\ui.ps1 reload               ask Metro to hot-reload the JS
#   .\scripts\ui.ps1 tap 540 1200         tap at device pixels (screenshots are 1:1)
#   .\scripts\ui.ps1 swipe 540 1800 540 600 300
#   .\scripts\ui.ps1 text "Wheat"         type into the focused field
#   .\scripts\ui.ps1 back                 hardware back
#   .\scripts\ui.ps1 home
#   .\scripts\ui.ps1 clear                wipe app data (resets role + AsyncStorage)
#   .\scripts\ui.ps1 logs                 recent RN/JS logcat lines
#   .\scripts\ui.ps1 errors               only RN errors + JS exceptions
#   .\scripts\ui.ps1 focus                which activity is in front
param(
  [Parameter(Mandatory = $true)][string]$Cmd,
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Args
)

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { throw "adb not found at $adb" }
$pkg = "com.fposetu.mobile"

switch ($Cmd) {
  "restart" {
    & $adb shell am force-stop $pkg
    & $adb shell am start -n "$pkg/.MainActivity"
  }
  "reload" {
    # RN's dev-server reload broadcast; no force-stop, so navigation state is lost
    # but the process (and any native module state) is not.
    & $adb shell input keyevent 82   # dev menu
    Start-Sleep -Milliseconds 400
    & $adb shell input text "r"
  }
  "tap"   { & $adb shell input tap $Args[0] $Args[1] }
  "swipe" {
    $dur = if ($Args.Count -ge 5) { $Args[4] } else { 300 }
    & $adb shell input swipe $Args[0] $Args[1] $Args[2] $Args[3] $dur
  }
  "text"  { & $adb shell input text ($Args[0] -replace ' ', '%s') }
  "back"  { & $adb shell input keyevent 4 }
  "home"  { & $adb shell input keyevent 3 }
  "clear" { & $adb shell pm clear $pkg }
  "focus" { & $adb shell dumpsys window | Select-String "mCurrentFocus" }
  "logs"  { & $adb logcat -d -t 200 ReactNative:V ReactNativeJS:V "*:S" }
  "errors" {
    & $adb logcat -d -t 400 ReactNative:E ReactNativeJS:E AndroidRuntime:E "*:S"
  }
  default { throw "unknown command '$Cmd'" }
}
