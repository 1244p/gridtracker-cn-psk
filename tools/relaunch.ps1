# Windows: stops only the dev copy launched with the debug port, waits until it's gone, then relaunches it.
#   powershell -File tools\relaunch.ps1          (re)launch the dev copy with --remote-debugging-port=9333
#   powershell -File tools\relaunch.ps1 stop     stop it only
# Run from the repo root. The installed GridTracker2 (no debug port) is never touched, but while it runs the
# dev copy exits at once (single-instance lock): ask the user to quit it.
$procs = Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*remote-debugging-port=9333*' }
foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -Confirm:$false -ErrorAction Stop } catch {} }
for ($i = 0; $i -lt 40; $i++) {
  $left = Get-CimInstance Win32_Process -Filter "Name='electron.exe'" | Where-Object { $_.CommandLine -like '*gridtracker2*' }
  if (-not $left) { break }
  Start-Sleep -Milliseconds 500
}
if ($args[0] -eq 'stop') { "stopped"; exit }
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
$p = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList "--no-sandbox","--remote-debugging-port=9333","." -WorkingDirectory (Get-Location) -PassThru
"launched $($p.Id)"
