$ErrorActionPreference = 'Stop'

$launcherPath = if ($env:PC_CONTROL_WINDOWS_LAUNCHER) {
  $env:PC_CONTROL_WINDOWS_LAUNCHER
} else {
  'C:\Users\Sevensoul\AppData\Local\Temp\start-pc-control-bridge-hidden.ps1'
}

$action = New-ScheduledTaskAction `
  -Execute 'powershell.exe' `
  -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launcherPath`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -Hidden

$principal = New-ScheduledTaskPrincipal `
  -UserId $env:USERNAME `
  -LogonType Interactive `
  -RunLevel Limited

Register-ScheduledTask `
  -TaskName 'OpenClawPcControlBridge' `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Start-ScheduledTask -TaskName 'OpenClawPcControlBridge'
Get-ScheduledTaskInfo -TaskName 'OpenClawPcControlBridge' | Select-Object LastRunTime, LastTaskResult
