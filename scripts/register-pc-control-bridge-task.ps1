param(
  [string]$TaskName = 'OpenClawPcControlBridge',
  [string]$Distro = 'Ubuntu',
  [string]$Root = '/home/mfshaf7/projects/openclaw-isolated-deployment'
)

$ErrorActionPreference = 'Stop'

$wslCommand = "$Root/scripts/start-pc-control-bridge.sh"
$wslArgs = "-d $Distro --cd $Root /bin/bash -lc `"$wslCommand`""

$action = New-ScheduledTaskAction -Execute 'wsl.exe' -Argument $wslArgs
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
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Output "Registered and started task: $TaskName"
