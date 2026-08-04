# Builds a locally-signed, installable release APK. Nothing leaves this machine.
#
# Usage (from a NORMAL PowerShell window, not an automated/sandboxed one):
#     cd C:\Users\MuditSengar\FPO\FPO-Setu-Mobile
#     .\build-apk.ps1
#
# If PowerShell blocks the script:
#     powershell -ExecutionPolicy Bypass -File .\build-apk.ps1

$ErrorActionPreference = "Stop"

$sdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$jbr = "C:\Program Files\Android\Android Studio\jbr"

if (-not (Test-Path $sdk)) { throw "Android SDK not found at $sdk" }
if (-not (Test-Path $jbr)) { throw "Android Studio JDK not found at $jbr" }

$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:JAVA_HOME = $jbr

Write-Host "ANDROID_HOME = $env:ANDROID_HOME"
Write-Host "JAVA_HOME    = $env:JAVA_HOME"
Write-Host ""

# --- Preflight -------------------------------------------------------------
# Gradle needs java.nio Selector, which on JDK 21/Windows is built on an AF_UNIX
# socket. In some restricted process contexts that call fails with
# "Invalid argument: connect" and every Gradle command dies with
# "Unable to establish loopback connection". Check it up front so the failure is
# obvious rather than buried in a Gradle stack trace.
Write-Host "Preflight: checking java.nio Selector..." -NoNewline
$probeDir = Join-Path $env:TEMP "fposetu-preflight"
New-Item -ItemType Directory -Force -Path $probeDir | Out-Null
$probe = Join-Path $probeDir "SelProbe.java"
@'
import java.nio.channels.Selector;
public class SelProbe {
  public static void main(String[] a) {
    try { Selector.open(); System.out.println("SELECTOR_OK"); }
    catch (Throwable t) { System.out.println("SELECTOR_FAIL " + t); }
  }
}
'@ | Out-File -FilePath $probe -Encoding ascii

$probeResult = & "$jbr\bin\java.exe" $probe 2>&1 | Out-String
Remove-Item -Recurse -Force $probeDir -ErrorAction SilentlyContinue

if ($probeResult -notmatch "SELECTOR_OK") {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host $probeResult
    Write-Host "Java cannot open an NIO Selector in this shell, so Gradle cannot run here." -ForegroundColor Yellow
    Write-Host "Try, in order:" -ForegroundColor Yellow
    Write-Host "  1. Run this script from a normal PowerShell window (not an IDE/agent/CI shell)."
    Write-Host "  2. Reboot, then retry - a pending Winsock/driver update can break AF_UNIX."
    Write-Host "  3. Build via Android Studio GUI instead:"
    Write-Host "     Open .\android  ->  Build > Build Bundle(s)/APK(s) > Build APK(s)"
    exit 1
}
Write-Host " OK" -ForegroundColor Green
Write-Host ""

# --- Build -----------------------------------------------------------------
Push-Location (Join-Path $PSScriptRoot "android")
try {
    Write-Host "Running gradlew assembleRelease (first run downloads Gradle, ~5-10 min)..."
    & .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

$apk = Join-Path $PSScriptRoot "android\app\build\outputs\apk\release\app-release.apk"
if (-not (Test-Path $apk)) { throw "Build reported success but APK not found at $apk" }

$sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
Write-Host ""
Write-Host "APK built: $apk ($sizeMb MB)" -ForegroundColor Green
Write-Host ""
Write-Host "Install on a connected device or running emulator:"
Write-Host "  $sdk\platform-tools\adb.exe install -r `"$apk`""
