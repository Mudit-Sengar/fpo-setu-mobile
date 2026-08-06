# Capture a screenshot from the connected Android device/emulator.
# Binary-safe: screencap writes on-device, then adb pull copies the file.
# PowerShell's `>` redirection mangles `adb exec-out` output, so don't use it.
#
#   .\scripts\shot.ps1 farmer-home        -> .shots\farmer-home.png
param(
  [string]$Name = "screen",
  [string]$OutDir = ".shots"
)

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { throw "adb not found at $adb" }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$dest = Join-Path $OutDir "$Name.png"

# The emulator exposes two displays; screencap warns and picks an arbitrary one
# unless told which. Pin to HWC display 0 (the phone screen).
$sf = & $adb shell dumpsys SurfaceFlinger --display-id
$displayId = ($sf | Select-String 'Display (\d+) \(HWC display 0\)').Matches.Groups[1].Value

if ($displayId) {
  & $adb shell screencap -d $displayId -p /sdcard/__shot.png
} else {
  & $adb shell screencap -p /sdcard/__shot.png
}
& $adb pull /sdcard/__shot.png $dest | Out-Null
& $adb shell rm /sdcard/__shot.png

if (-not (Test-Path $dest)) { throw "screenshot failed" }
(Resolve-Path $dest).Path
