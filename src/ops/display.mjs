import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildWindowsExecOptions, resolveWindowsPowerShellBinary } from "./windows-shell.mjs";

const execFileAsync = promisify(execFile);
const WINDOWS_POWERSHELL_BIN = resolveWindowsPowerShellBinary();

const WINDOWS_SCRIPT_FALLBACK_DIR = "/mnt/c/ProgramData/OpenClaw/Platform-Core/runtime";
const WINDOWS_SCRIPT_FALLBACK_BIN = "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe";
const WINDOWS_CAPTURE_DIR = path.posix.join(WINDOWS_SCRIPT_FALLBACK_DIR, "screenshots");

function windowsScriptFilePath(fileName) {
  return toWindowsPath(path.posix.join(WINDOWS_SCRIPT_FALLBACK_DIR, fileName));
}

async function runPowerShellViaScriptFile(command, timeout) {
  await fs.mkdir(WINDOWS_SCRIPT_FALLBACK_DIR, { recursive: true });
  const fileName = `openclaw-host-bridge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`;
  const scriptPath = path.posix.join(WINDOWS_SCRIPT_FALLBACK_DIR, fileName);
  const windowsPath = windowsScriptFilePath(fileName);
  await fs.writeFile(scriptPath, String(command ?? ""), "utf8");
  try {
    const { stdout } = await execFileAsync(
      WINDOWS_SCRIPT_FALLBACK_BIN,
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", windowsPath],
      buildWindowsExecOptions({
        timeout,
        maxBuffer: 1024 * 1024,
      }),
    );
    return stdout;
  } finally {
    await fs.rm(scriptPath, { force: true }).catch(() => undefined);
  }
}

async function runPowerShell(command, timeout = 15000) {
  return await runPowerShellViaScriptFile(command, timeout);
}

function parseWrittenScreenshotIndexes(stdout, expectedCount) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) {
    return [];
  }
  try {
    const parsed = JSON.parse(trimmed);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return [
      ...new Set(
        values
          .map((value) => Number.parseInt(String(value), 10))
          .filter((value) => Number.isInteger(value) && value >= 0 && value < expectedCount),
      ),
    ];
  } catch {
    return [];
  }
}

async function resolveExistingScreenshotArtifacts(stagedPaths, statFn) {
  const artifacts = [];
  for (const [index, entry] of stagedPaths.entries()) {
    const stat = await statFn(entry).catch(() => null);
    if (stat) {
      artifacts.push({ index, path: entry, stat });
    }
  }
  return artifacts;
}

function toWindowsPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const normalized = value.trim();
  const match = /^\/mnt\/([a-z])(?:\/(.*))?$/i.exec(normalized);
  if (!match) {
    return normalized;
  }
  const drive = match[1].toUpperCase();
  const tail = (match[2] || "").replace(/\//g, "\\");
  return tail ? `${drive}:\\${tail}` : `${drive}:\\`;
}

function splitScreenshotName(requestedName) {
  const parsed = path.parse(
    typeof requestedName === "string" && requestedName.trim() ? requestedName.trim() : "desktop-screenshot.png",
  );
  return {
    base: parsed.name || "desktop-screenshot",
    ext: parsed.ext || ".png",
  };
}

async function allocateScreenshotPath(config, requestedName) {
  const { base, ext } = splitScreenshotName(requestedName);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  await fs.mkdir(config.stagingDir, { recursive: true });
  return path.join(config.stagingDir, `${base}-${timestamp}-${suffix}${ext}`);
}

async function allocateScreenshotPaths(config, requestedName, count) {
  const { base, ext } = splitScreenshotName(requestedName);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  await fs.mkdir(config.stagingDir, { recursive: true });
  return Array.from({ length: count }, (_, index) =>
    path.join(config.stagingDir, `${base}-display-${index + 1}-${timestamp}-${suffix}${ext}`),
  );
}

async function allocateCapturePaths(requestedName, count) {
  const { base, ext } = splitScreenshotName(requestedName);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  await fs.mkdir(WINDOWS_CAPTURE_DIR, { recursive: true });
  return Array.from({ length: count }, (_, index) =>
    path.posix.join(WINDOWS_CAPTURE_DIR, `${base}-display-${index + 1}-${timestamp}-${suffix}${ext}`),
  );
}

export async function monitorPower(_config, args) {
  const action = typeof args?.action === "string" ? args.action.trim().toLowerCase() : "";
  if (action !== "off" && action !== "on") {
    const err = new Error("action must be 'off' or 'on'");
    err.code = "invalid_argument";
    throw err;
  }
  if (action === "off") {
    await runPowerShell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMonitorPower {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr SendMessageTimeout(
    IntPtr hWnd,
    UInt32 Msg,
    IntPtr wParam,
    IntPtr lParam,
    UInt32 fuFlags,
    UInt32 uTimeout,
    out IntPtr lpdwResult
  );
}
"@;
$result = [intptr]::Zero
[NativeMonitorPower]::SendMessageTimeout([intptr]0xffff, 0x0112, [intptr]0xF170, [intptr]2, 0x0002, 2000, [ref]$result) | Out-Null
`);
  } else {
    await runPowerShell(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMouseWake {
  [StructLayout(LayoutKind.Sequential)]
  public struct INPUT {
    public UInt32 type;
    public MOUSEINPUT mi;
  }

  [StructLayout(LayoutKind.Sequential)]
  public struct MOUSEINPUT {
    public Int32 dx;
    public Int32 dy;
    public UInt32 mouseData;
    public UInt32 dwFlags;
    public UInt32 time;
    public IntPtr dwExtraInfo;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern UInt32 SendInput(UInt32 nInputs, INPUT[] pInputs, Int32 cbSize);
}
"@;
$inputs = New-Object NativeMouseWake+INPUT[] 2
$inputs[0].type = 0
$inputs[0].mi.dx = 8
$inputs[0].mi.dy = 0
$inputs[0].mi.dwFlags = 0x0001
$inputs[1].type = 0
$inputs[1].mi.dx = -8
$inputs[1].mi.dy = 0
$inputs[1].mi.dwFlags = 0x0001
[NativeMouseWake]::SendInput([uint32]$inputs.Length, $inputs, [System.Runtime.InteropServices.Marshal]::SizeOf([type][NativeMouseWake+INPUT])) | Out-Null
Start-Sleep -Milliseconds 120
$inputs[0].mi.dx = 0
$inputs[0].mi.dy = 8
$inputs[1].mi.dx = 0
$inputs[1].mi.dy = -8
[NativeMouseWake]::SendInput([uint32]$inputs.Length, $inputs, [System.Runtime.InteropServices.Marshal]::SizeOf([type][NativeMouseWake+INPUT])) | Out-Null
Start-Sleep -Milliseconds 120
Add-Type -AssemblyName System.Windows.Forms;
if ([System.Windows.Forms.Control]::IsKeyLocked([System.Windows.Forms.Keys]::Scroll)) {
  [System.Windows.Forms.SendKeys]::SendWait("{SCROLLLOCK}")
}
`);
  }
  return { powered: action };
}

export async function captureScreenshot(config, args, deps = {}) {
  const runPowerShellFn = deps.runPowerShell ?? runPowerShell;
  const allocateScreenshotPathFn = deps.allocateScreenshotPath ?? allocateScreenshotPath;
  const allocateScreenshotPathsFn = deps.allocateScreenshotPaths ?? allocateScreenshotPaths;
  const allocateCapturePathsFn = deps.allocateCapturePaths ?? allocateCapturePaths;
  const statFn = deps.stat ?? ((entry) => fs.stat(entry));
  const copyFileFn = deps.copyFile ?? ((source, destination) => fs.copyFile(source, destination));
  const removeFileFn = deps.removeFile ?? ((entry) => fs.rm(entry, { force: true }));

  const probeScript = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.Screen]::AllScreens.Count
`;
  const countStdout = await runPowerShellFn(probeScript, 5000);
  const displayCount = Math.max(1, Number.parseInt(String(countStdout || "").trim(), 10) || 1);
  const finalPaths =
    displayCount === 1
      ? [await allocateScreenshotPathFn(config, args?.file_name)]
      : await allocateScreenshotPathsFn(config, args?.file_name, displayCount);
  const capturePaths = await allocateCapturePathsFn(args?.file_name, displayCount);
  const captureWindowsPaths = capturePaths.map((entry) => toWindowsPath(entry));
  if (captureWindowsPaths.some((entry) => !entry)) {
    const err = new Error("Unable to translate screenshot capture path for Windows export");
    err.code = "invalid_argument";
    throw err;
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$screens = [System.Windows.Forms.Screen]::AllScreens;
$targets = @(
${captureWindowsPaths.map((entry) => `  '${entry.replace(/'/g, "''")}'`).join(",\n")}
);
$writtenIndexes = New-Object System.Collections.Generic.List[int];
$failures = New-Object System.Collections.Generic.List[string];
for ($i = 0; $i -lt $screens.Length; $i++) {
  $screen = $screens[$i];
  $target = $targets[$i];
  $bitmap = $null;
  $graphics = $null;
  try {
    $bounds = $screen.Bounds;
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap);
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png);
    if (Test-Path -LiteralPath $target) {
      [void]$writtenIndexes.Add($i);
    }
  } catch {
    $failureMessage = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { $_.ToString() };
    [void]$failures.Add($failureMessage);
  } finally {
    if ($graphics -ne $null) {
      $graphics.Dispose();
    }
    if ($bitmap -ne $null) {
      $bitmap.Dispose();
    }
  }
}
if ($writtenIndexes.Count -eq 0) {
  if ($failures.Count -gt 0) {
    throw [System.InvalidOperationException]::new("Screenshot capture failed: " + ($failures -join "; "))
  }
  throw [System.InvalidOperationException]::new("Screenshot capture returned no written files")
}
$writtenIndexes | ConvertTo-Json -Compress
`;
  const stdout = await runPowerShellFn(script);
  const writtenIndexes = parseWrittenScreenshotIndexes(stdout, capturePaths.length);
  const candidatePaths = writtenIndexes.length > 0 ? writtenIndexes.map((index) => capturePaths[index]) : capturePaths;
  const existingArtifacts = await resolveExistingScreenshotArtifacts(candidatePaths, statFn);
  if (existingArtifacts.length === 0) {
    const err = new Error("Screenshot capture returned no readable files");
    err.code = "capture_failed";
    throw err;
  }

  const finalizedArtifacts = [];
  for (const artifact of existingArtifacts) {
    const finalPath = finalPaths[artifact.index];
    if (!finalPath) {
      continue;
    }
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    if (artifact.path !== finalPath) {
      await copyFileFn(artifact.path, finalPath);
      await removeFileFn(artifact.path).catch(() => undefined);
    }
    const finalStat = await statFn(finalPath);
    finalizedArtifacts.push({ path: finalPath, stat: finalStat });
  }

  if (finalizedArtifacts.length === 0) {
    const err = new Error("Screenshot capture produced no finalized exports");
    err.code = "capture_failed";
    throw err;
  }

  return {
    path: finalizedArtifacts[0].path,
    paths: finalizedArtifacts.map((entry) => entry.path),
    file_name: path.basename(finalizedArtifacts[0].path),
    size: finalizedArtifacts.reduce((sum, entry) => sum + entry.stat.size, 0),
    displays: finalizedArtifacts.map((entry, index) => ({
      path: entry.path,
      primary: index === 0,
    })),
  };
}
