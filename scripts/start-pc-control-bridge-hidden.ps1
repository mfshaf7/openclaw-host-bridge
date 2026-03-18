$ErrorActionPreference = 'Stop'

$distro = if ($env:PC_CONTROL_WSL_DISTRO) { $env:PC_CONTROL_WSL_DISTRO } else { 'Ubuntu' }
$root = if ($env:PC_CONTROL_ROOT) { $env:PC_CONTROL_ROOT } else { '/home/mfshaf7/projects/openclaw-isolated-deployment' }
$launcher = "$root/scripts/start-pc-control-bridge-daemon.sh"
$wslArgs = "-d $distro --cd $root /bin/bash -lc `"$launcher`""

Start-Process -FilePath 'wsl.exe' -ArgumentList $wslArgs -WindowStyle Hidden
