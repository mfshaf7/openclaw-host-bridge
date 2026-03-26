$ErrorActionPreference = 'Stop'

$distro = if ($env:PC_CONTROL_WSL_DISTRO) { $env:PC_CONTROL_WSL_DISTRO } else { 'Ubuntu' }
$defaultRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$root = if ($env:PC_CONTROL_ROOT) { $env:PC_CONTROL_ROOT } else { $defaultRoot }
$launcher = "$root/scripts/start-pc-control-bridge-tmux.sh"
$wslArgs = @(
  '-d', $distro,
  '--cd', $root,
  '/bin/bash', '-lc', $launcher
)

$process = Start-Process `
  -FilePath 'wsl.exe' `
  -ArgumentList $wslArgs `
  -WindowStyle Hidden `
  -PassThru

$process.Id
