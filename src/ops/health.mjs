import os from "node:os";
import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { resolveWindowsPowerShellBinary } from "./windows-shell.mjs";

const execFile = promisify(execFileCallback);
const WINDOWS_POWERSHELL_BIN = resolveWindowsPowerShellBinary();
const DEFAULT_WINDOWS_HEALTH_SNAPSHOT = "/mnt/c/ProgramData/OpenClaw/Platform-Core/runtime/windows-health.json";
const WINDOWS_HEALTH_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 1000;

function isWsl() {
  return Boolean(process.env.WSL_DISTRO_NAME) || /microsoft/i.test(os.release());
}

async function pathState(targetPath) {
  try {
    const stats = await fs.stat(targetPath);
    return {
      path: targetPath,
      exists: true,
      kind: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
    };
  } catch {
    return {
      path: targetPath,
      exists: false,
    };
  }
}

async function safeFetchJson(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json, text/plain;q=0.9, */*;q=0.1" },
    });
    const contentType = response.headers.get("content-type") || "";
    const bodyText = await response.text();
    let body = bodyText;
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        body = bodyText;
      }
    }
    return {
      ok: response.ok,
      status: response.status,
      url,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: String(error?.message || error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function execPowerShellJson(script, timeoutMs = 3000) {
  try {
    const { stdout } = await execFile(
      WINDOWS_POWERSHELL_BIN,
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      { timeout: timeoutMs, maxBuffer: 1024 * 1024 },
    );
    const trimmed = String(stdout || "").trim();
    if (!trimmed) {
      return null;
    }
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

async function execDockerInspect() {
  try {
    const { stdout } = await execFile(
      "docker",
      [
        "inspect",
        "upstream-openclaw-openclaw-gateway-1",
        "--format",
        "{{json .State}}",
      ],
      { timeout: 2500, maxBuffer: 256 * 1024 },
    );
    const trimmed = String(stdout || "").trim();
    return trimmed ? JSON.parse(trimmed) : null;
  } catch {
    return null;
  }
}

async function getGatewayStatus() {
  const dockerState = await execDockerInspect();
  if (dockerState) {
    return {
      source: "docker",
      ok:
        dockerState.Status === "running" &&
        ((dockerState.Health && dockerState.Health.Status === "healthy") || !dockerState.Health),
      status: dockerState.Status,
      health: dockerState.Health?.Status || null,
    };
  }
  const gatewayHealthUrl =
    process.env.OPENCLAW_GATEWAY_HEALTH_URL || "http://127.0.0.1:18789/healthz";
  const httpState = await safeFetchJson(gatewayHealthUrl, 1500);
  if (httpState.ok) {
    const body =
      httpState.body && typeof httpState.body === "object" && !Array.isArray(httpState.body)
        ? httpState.body
        : null;
    return {
      source: "http",
      url: gatewayHealthUrl,
      ok: body?.ok === true || httpState.status === 200,
      status: httpState.status,
      body,
    };
  }
  return {
    source: "http",
    url: gatewayHealthUrl,
    ok: false,
    error: httpState.error || "gateway health check failed",
  };
}

async function sampleCpuUtilizationPercent() {
  const first = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const second = os.cpus();
  if (!first.length || first.length !== second.length) {
    return null;
  }
  let idleDelta = 0;
  let totalDelta = 0;
  for (let index = 0; index < first.length; index += 1) {
    const a = first[index].times;
    const b = second[index].times;
    const idle = b.idle - a.idle;
    const total =
      b.user -
      a.user +
      (b.nice - a.nice) +
      (b.sys - a.sys) +
      (b.irq - a.irq) +
      idle;
    idleDelta += idle;
    totalDelta += total;
  }
  if (totalDelta <= 0) {
    return null;
  }
  return Math.max(0, Math.min(100, Math.round(((totalDelta - idleDelta) / totalDelta) * 100)));
}

async function resolveWindowsHealthSnapshotPath() {
  if (process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT) {
    return process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT;
  }
  return DEFAULT_WINDOWS_HEALTH_SNAPSHOT;
}

async function readWindowsHealthSnapshot() {
  if (!isWsl()) {
    return null;
  }
  const snapshotPath = await resolveWindowsHealthSnapshotPath();
  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    const generatedAtMs = Date.parse(parsed?.generatedAt || "");
    const ageMs = Number.isFinite(generatedAtMs) ? Date.now() - generatedAtMs : null;
    return {
      path: snapshotPath,
      ageMs,
      ok: ageMs !== null && ageMs <= WINDOWS_HEALTH_SNAPSHOT_MAX_AGE_MS,
      data: parsed,
    };
  } catch (error) {
    return {
      path: snapshotPath,
      ok: false,
      error: String(error?.message || error),
      data: null,
      ageMs: null,
    };
  }
}

async function getWindowsPanelInfo() {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name,CurrentClockSpeed",
    "$video = Get-CimInstance Win32_VideoController | Where-Object { $_.CurrentHorizontalResolution -or $_.CurrentRefreshRate } | Select-Object -First 1 Name,AdapterRAM,CurrentRefreshRate,CurrentHorizontalResolution,CurrentVerticalResolution",
    "if (-not $video) { $video = Get-CimInstance Win32_VideoController | Select-Object -First 1 Name,AdapterRAM,CurrentRefreshRate,CurrentHorizontalResolution,CurrentVerticalResolution }",
    "$memClock = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property ConfiguredClockSpeed -Maximum).Maximum",
    "$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds",
    "@{",
    "  cpu = @{ model = $cpu.Name; clockMhz = $cpu.CurrentClockSpeed }",
    "  gpu = @{ name = $video.Name; vramTotalBytes = $video.AdapterRAM }",
    "  ram = @{ clockMhz = $memClock }",
    "  display = @{ width = $bounds.Width; height = $bounds.Height; refreshHz = $video.CurrentRefreshRate }",
    "} | ConvertTo-Json -Depth 6 -Compress",
  ].join("\n");
  return await execPowerShellJson(script, 10000);
}

async function getWindowsPublicIp() {
  return await execPowerShellJson(
    [
      "$ErrorActionPreference = 'Stop'",
      "$publicIp = $null",
      "foreach ($url in @('http://ifconfig.me/ip','https://api.ipify.org')) {",
      "  try {",
      "    $value = (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 3).Content.Trim()",
      "    if ($value) { $publicIp = $value; break }",
      "  } catch {}",
      "}",
      "if ($publicIp) { @{ ok = $true; address = $publicIp; provider = 'windows:web' } | ConvertTo-Json -Compress }",
      "else { @{ ok = $false } | ConvertTo-Json -Compress }",
    ].join("\n"),
    10000,
  );
}

async function getWindowsNvidiaGpuInfo() {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$paths = @(",
    "  \"$env:ProgramFiles\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe\",",
    "  \"$env:SystemRoot\\System32\\nvidia-smi.exe\"",
    ")",
    "$exe = $paths | Where-Object { Test-Path $_ } | Select-Object -First 1",
    "if (-not $exe) { @{ ok = $false; error = 'nvidia-smi not found' } | ConvertTo-Json -Compress; exit 0 }",
    "$line = & $exe --query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,clocks.current.graphics --format=csv,noheader,nounits | Select-Object -First 1",
    "if (-not $line) { @{ ok = $false; error = 'no gpu rows' } | ConvertTo-Json -Compress; exit 0 }",
    "$parts = $line.Split(',') | ForEach-Object { $_.Trim() }",
    "@{",
    "  ok = $true",
    "  name = $parts[0]",
    "  temperatureC = [int]$parts[1]",
    "  utilizationPercent = [int]$parts[2]",
    "  vramUsedMB = [int]$parts[3]",
    "  vramTotalMB = [int]$parts[4]",
    "  clockMhz = [int]$parts[5]",
    "} | ConvertTo-Json -Compress",
  ].join("\n");
  return await execPowerShellJson(script, 8000);
}

async function getOllamaStatus() {
  const localResult = await safeFetchJson("http://127.0.0.1:11434/api/tags", 1200);
  if (localResult.ok) {
    return localResult;
  }
  const windowsResult = await execPowerShellJson(
    [
      "$ErrorActionPreference = 'Stop'",
      "try {",
      "  $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2",
      "  @{ ok = $true; status = [int]$response.StatusCode; body = ($response.Content | ConvertFrom-Json) } | ConvertTo-Json -Depth 8 -Compress",
      "} catch {",
      "  @{ ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress",
      "}",
    ].join("\n"),
    8000,
  );
  return windowsResult || localResult;
}

export async function healthCheck(config) {
  const [allowedRoots, stagingDir, auditDir, cpuUtilizationPercent, gatewayState, snapshotState] = await Promise.all([
    Promise.all(config.allowedRoots.map((root) => pathState(root))),
    pathState(config.stagingDir),
    pathState(config.auditDir),
    sampleCpuUtilizationPercent(),
    getGatewayStatus(),
    readWindowsHealthSnapshot(),
  ]);

  const windowsPanel = snapshotState?.ok ? snapshotState.data?.panel ?? null : await getWindowsPanelInfo();
  const windowsPublicIp = snapshotState?.ok ? snapshotState.data?.panel?.publicIp ?? null : await getWindowsPublicIp();
  const windowsGpu = snapshotState?.ok ? snapshotState.data?.panel?.gpu ?? null : await getWindowsNvidiaGpuInfo();
  const ollama = snapshotState?.ok ? snapshotState.data?.ollama ?? null : await getOllamaStatus();

  const cpuInfo = os.cpus();
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  const firstCpu = cpuInfo[0] || null;
  const panel = {
    cpu: {
      model: windowsPanel?.cpu?.model || firstCpu?.model || null,
      utilizationPercent: cpuUtilizationPercent,
      clockMhz:
        Number.isFinite(Number(windowsPanel?.cpu?.clockMhz))
          ? Number(windowsPanel.cpu.clockMhz)
          : Number.isFinite(Number(firstCpu?.speed))
            ? Number(firstCpu.speed)
            : null,
    },
    gpu:
      (windowsGpu?.ok === true || (windowsPanel?.gpu && typeof windowsPanel.gpu === "object"))
        ? {
            name: windowsGpu?.name || windowsPanel?.gpu?.name || null,
            utilizationPercent: Number.isFinite(Number(windowsGpu?.utilizationPercent))
              ? Number(windowsGpu.utilizationPercent)
              : null,
            temperatureC: Number.isFinite(Number(windowsGpu?.temperatureC))
              ? Number(windowsGpu.temperatureC)
              : null,
            vramUsedBytes: Number.isFinite(Number(windowsGpu?.vramUsedMB))
              ? Number(windowsGpu.vramUsedMB) * 1024 * 1024
              : Number.isFinite(Number(windowsGpu?.vramUsedBytes))
                ? Number(windowsGpu.vramUsedBytes)
                : null,
            vramTotalBytes: Number.isFinite(Number(windowsGpu?.vramTotalMB))
              ? Number(windowsGpu.vramTotalMB) * 1024 * 1024
              : Number.isFinite(Number(windowsGpu?.vramTotalBytes))
                ? Number(windowsGpu.vramTotalBytes)
                : Number.isFinite(Number(windowsPanel?.gpu?.vramTotalBytes))
                  ? Number(windowsPanel.gpu.vramTotalBytes)
                  : null,
            clockMhz: Number.isFinite(Number(windowsGpu?.clockMhz)) ? Number(windowsGpu.clockMhz) : null,
          }
        : undefined,
    ram: {
      totalBytes,
      freeBytes,
      usedBytes,
      usedPercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : null,
      clockMhz:
        Number.isFinite(Number(windowsPanel?.ram?.clockMhz)) ? Number(windowsPanel.ram.clockMhz) : null,
    },
    display:
      windowsPanel?.display && typeof windowsPanel.display === "object"
        ? {
            width: Number.isFinite(Number(windowsPanel.display.width)) ? Number(windowsPanel.display.width) : null,
            height: Number.isFinite(Number(windowsPanel.display.height))
              ? Number(windowsPanel.display.height)
              : null,
            refreshHz: Number.isFinite(Number(windowsPanel.display.refreshHz))
              ? Number(windowsPanel.display.refreshHz)
              : null,
          }
        : undefined,
    publicIp:
      windowsPublicIp && typeof windowsPublicIp === "object"
        ? windowsPublicIp
        : undefined,
  };

  const bridge = {
    ok: true,
    service: "openclaw-host-bridge",
    listen: {
      host: config.listenHost,
      port: config.listenPort,
    },
    configPath: config.configPath,
    mode: config.mode,
  };

  const host = {
    ok: true,
    hostname: os.hostname(),
    platform: process.platform,
    release: os.release(),
    uptimeSec: os.uptime(),
    memory: {
      totalBytes,
      freeBytes,
    },
  };

  const storage = {
    ok: allowedRoots.every((entry) => entry.exists === true),
    allowedRoots,
    stagingDir,
    auditDir,
  };

  if (stagingDir.exists !== true || auditDir.exists !== true) {
    storage.ok = false;
  }

  const integrations = {
    wsl: {
      detected: isWsl(),
      ok: isWsl(),
    },
    gateway:
      gatewayState && typeof gatewayState === "object"
        ? gatewayState
        : {
            ok: false,
          },
    ollama:
      ollama && typeof ollama === "object"
        ? ollama
        : {
            ok: false,
          },
  };

  const diagnostics = {
    windowsSnapshot:
      snapshotState && typeof snapshotState === "object"
        ? {
            path: snapshotState.path,
            ok: snapshotState.ok,
            ageMs: snapshotState.ageMs,
            error: snapshotState.error || null,
          }
        : undefined,
  };

  const ok =
    bridge.ok === true &&
    host.ok === true &&
    storage.ok === true &&
    Object.values(integrations).every((entry) => entry?.ok === true || entry?.detected === true);

  return {
    ok,
    components: {
      panel,
      bridge,
      host,
      storage,
      integrations,
      diagnostics,
    },
  };
}
