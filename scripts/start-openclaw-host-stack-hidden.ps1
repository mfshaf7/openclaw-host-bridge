$ErrorActionPreference = 'Stop'

$distro = if ($env:OPENCLAW_HOST_BRIDGE_WSL_DISTRO) { $env:OPENCLAW_HOST_BRIDGE_WSL_DISTRO } else { 'Ubuntu' }
$defaultRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$root = if ($env:OPENCLAW_HOST_BRIDGE_ROOT) { $env:OPENCLAW_HOST_BRIDGE_ROOT } else { $defaultRoot }
$launcher = "$root/scripts/start-openclaw-host-stack-tmux.sh"
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
