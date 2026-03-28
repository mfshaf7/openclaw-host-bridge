$ErrorActionPreference = 'Stop'

$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$launcherPath = if ($env:OPENCLAW_HOST_BRIDGE_WINDOWS_LAUNCHER) {
  $env:OPENCLAW_HOST_BRIDGE_WINDOWS_LAUNCHER
} else {
  (Join-Path $env:TEMP 'start-openclaw-host-bridge-hidden.ps1')
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -Hidden

$principal = New-ScheduledTaskPrincipal `
  -UserId $userId `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName 'OpenClawHostBridge' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Start-ScheduledTask -TaskName 'OpenClawHostBridge'
Get-ScheduledTaskInfo -TaskName 'OpenClawHostBridge' | Select-Object LastRunTime, LastTaskResult
