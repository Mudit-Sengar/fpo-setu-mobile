# Query the app's on-device SQLite database (src/db writes to databases/fposetu.sqlite).
# Useful for confirming a screen renders what the DB actually holds, rather than
# trusting the screen alone.
#
#   .\scripts\db.ps1                                  list tables
#   .\scripts\db.ps1 "select count(*) from fpos"
#   .\scripts\db.ps1 "select name from fpos limit 5"
param([string]$Sql)

$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) { throw "adb not found at $adb" }
$db = "databases/fposetu.sqlite"

# The SQL must survive two shells (PowerShell, then the device sh), so it goes
# through as one single-quoted argument to the device shell.
if ([string]::IsNullOrWhiteSpace($Sql)) {
  & $adb shell "run-as com.fposetu.mobile sqlite3 $db '.tables'"
} else {
  $escaped = $Sql -replace "'", "'\''"
  & $adb shell "run-as com.fposetu.mobile sqlite3 $db '$escaped'"
}
