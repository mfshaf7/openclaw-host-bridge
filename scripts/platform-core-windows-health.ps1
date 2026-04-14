param(
  [switch]$Loop,
  [int]$IntervalSeconds = 30
)

$ErrorActionPreference = "Stop"

$runtimeDir = if ($env:OPENCLAW_WINDOWS_HEALTH_RUNTIME_DIR) {
  $env:OPENCLAW_WINDOWS_HEALTH_RUNTIME_DIR
} else {
  Join-Path $PSScriptRoot ".runtime"
}
$snapshotPath = Join-Path $runtimeDir "windows-health.json"
$logPath = Join-Path $runtimeDir "windows-health.log"

function Write-HealthLog {
  param(
    [string]$Message
  )

  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f (Get-Date).ToString("s"), $Message)
}

function Get-DisplayInfo {
  Add-Type -AssemblyName System.Windows.Forms
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  [pscustomobject]@{
    Width  = $bounds.Width
    Height = $bounds.Height
  }
}

function Get-CpuState {
  $cpuKey = "HKLM:\HARDWARE\DESCRIPTION\System\CentralProcessor\0"
  try {
    $cpu = Get-ItemProperty -Path $cpuKey
    return @{
      model    = $cpu.ProcessorNameString
      clockMhz = if ($cpu."~MHz") { [int]$cpu."~MHz" } else { $null }
    }
  } catch {
    return @{
      model    = $env:PROCESSOR_IDENTIFIER
      clockMhz = $null
    }
  }
}

function Get-PublicIpState {
  foreach ($url in @("http://ifconfig.me/ip", "https://api.ipify.org")) {
    try {
      $value = (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3).Content.Trim()
      if ($value) {
        return @{
          ok       = $true
          address  = $value
          provider = "windows:web"
        }
      }
    } catch {
    }
  }
  return @{
    ok = $false
  }
}

function Get-NvidiaGpuState {
  $paths = @(
    (Join-Path $env:ProgramFiles "NVIDIA Corporation\NVSMI\nvidia-smi.exe"),
    (Join-Path $env:SystemRoot "System32\nvidia-smi.exe")
  )
  $exe = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $exe) {
    return $null
  }

  try {
    $line = & $exe --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,clocks.current.graphics --format=csv,noheader,nounits |
      Select-Object -First 1
    if (-not $line) {
      return $null
    }
    $parts = $line.Split(",") | ForEach-Object { $_.Trim() }
    return @{
      name               = $parts[0]
      temperatureC       = [int]$parts[1]
      utilizationPercent = [int]$parts[2]
      vramUsedBytes      = [int64]$parts[3] * 1MB
      vramTotalBytes     = [int64]$parts[4] * 1MB
      clockMhz           = [int]$parts[5]
    }
  } catch {
    return $null
  }
}

function Get-OllamaState {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 3
    return @{
      ok     = $true
      status = [int]$response.StatusCode
      body   = ($response.Content | ConvertFrom-Json)
    }
  } catch {
    return @{
      ok    = $false
      error = $_.Exception.Message
    }
  }
}

function New-Snapshot {
  $cpu = Get-CpuState
  $displayInfo = Get-DisplayInfo
  $gpu = Get-NvidiaGpuState

  return @{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    panel       = @{
      cpu      = @{
        model    = $cpu.model
        clockMhz = $cpu.clockMhz
      }
      gpu      = $gpu
      ram      = @{
        clockMhz = $null
      }
      display  = @{
        width     = [int]$displayInfo.Width
        height    = [int]$displayInfo.Height
        refreshHz = $null
      }
      publicIp = Get-PublicIpState
    }
    ollama      = Get-OllamaState
  }
}

function Write-Snapshot {
  New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
  $snapshot = New-Snapshot
  $json = $snapshot | ConvertTo-Json -Depth 10
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($snapshotPath, $json, $utf8NoBom)
}

do {
  try {
    Write-Snapshot
  } catch {
    Write-HealthLog $_
    if (-not $Loop) {
      throw
    }
  }

  if (-not $Loop) {
    break
  }

  Start-Sleep -Seconds ([Math]::Max(5, $IntervalSeconds))
} while ($true)
