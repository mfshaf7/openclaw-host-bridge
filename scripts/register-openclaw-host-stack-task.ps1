param(
  [string]$TaskName = 'PlatformCoreHostStack',
  [string]$Distro = 'Platform-Core',
  [string]$Root = ''
)

$ErrorActionPreference = 'Stop'

if (-not $Root) {
  $Root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
}

$wslCommand = "systemctl start openclaw-host-stack.target && systemctl --quiet is-active openclaw-host-stack.target openclaw-host-bridge.service openclaw-host-recovery.service"
$wslArgs = "-d $Distro -u root --cd $Root /bin/bash -lc `"$wslCommand`""

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
