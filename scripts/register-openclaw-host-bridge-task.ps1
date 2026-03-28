param(
  [string]$TaskName = 'OpenClawPcControlBridge',
  [string]$Distro = 'Ubuntu',
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
}

$wslCommand = "$Root/scripts/start-openclaw-host-bridge-tmux.sh"
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
