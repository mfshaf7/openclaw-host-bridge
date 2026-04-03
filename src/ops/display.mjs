import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveWindowsPowerShellBinary } from "./windows-shell.mjs";

const execFileAsync = promisify(execFile);
const WINDOWS_POWERSHELL_BIN = resolveWindowsPowerShellBinary();

async function runPowerShell(command, timeout = 15000) {
  await execFileAsync(WINDOWS_POWERSHELL_BIN, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ], {
    timeout,
    maxBuffer: 1024 * 1024,
  });
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

async function allocateScreenshotPath(config, requestedName) {
  const parsed = path.parse(
    typeof requestedName === "string" && requestedName.trim() ? requestedName.trim() : "desktop-screenshot.png",
  );
  const base = parsed.name || "desktop-screenshot";
  const ext = parsed.ext || ".png";
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  await fs.mkdir(config.stagingDir, { recursive: true });
  return path.join(config.stagingDir, `${base}-${timestamp}-${suffix}${ext}`);
}

async function allocateScreenshotPaths(config, requestedName, count) {
  const parsed = path.parse(
    typeof requestedName === "string" && requestedName.trim() ? requestedName.trim() : "desktop-screenshot.png",
  );
  const base = parsed.name || "desktop-screenshot";
  const ext = parsed.ext || ".png";
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  await fs.mkdir(config.stagingDir, { recursive: true });
  return Array.from({ length: count }, (_, index) =>
    path.join(config.stagingDir, `${base}-display-${index + 1}-${timestamp}-${suffix}${ext}`),
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
public static class NativeDisplayWake {
  [StructLayout(LayoutKind.Sequential)]
  public struct POINT {
    public Int32 X;
    public Int32 Y;
  }

  [DllImport("kernel32.dll", SetLastError = true)]
  public static extern UInt32 SetThreadExecutionState(UInt32 esFlags);

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

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void mouse_event(UInt32 dwFlags, UInt32 dx, UInt32 dy, UInt32 dwData, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern void keybd_event(byte bVk, byte bScan, UInt32 dwFlags, UIntPtr dwExtraInfo);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool GetCursorPos(out POINT lpPoint);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool SetCursorPos(Int32 X, Int32 Y);
}
"@;
$result = [IntPtr]::Zero
[NativeDisplayWake]::SendMessageTimeout([IntPtr]0xffff, 0x0112, [IntPtr]0xF170, [IntPtr](-1), 0x0002, 1500, [ref]$result) | Out-Null
[NativeDisplayWake]::SetThreadExecutionState([uint32]2147483651) | Out-Null
Start-Sleep -Milliseconds 150

Add-Type -AssemblyName System.Windows.Forms;
if ([System.Windows.Forms.Screen]::AllScreens.Count -gt 1) {
  $displaySwitch = Join-Path $env:SystemRoot 'System32\DisplaySwitch.exe'
  if (Test-Path $displaySwitch) {
    Start-Process -FilePath $displaySwitch -ArgumentList '/extend' -WindowStyle Hidden -Wait
    Start-Sleep -Milliseconds 1200
  }
}

[NativeDisplayWake]::keybd_event(0x5B, 0, 0, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x11, 0, 0, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x10, 0, 0, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x42, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 120
[NativeDisplayWake]::keybd_event(0x42, 0, 0x0002, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x10, 0, 0x0002, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x11, 0, 0x0002, [UIntPtr]::Zero)
[NativeDisplayWake]::keybd_event(0x5B, 0, 0x0002, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 500

$cursor = New-Object NativeDisplayWake+POINT
if ([NativeDisplayWake]::GetCursorPos([ref]$cursor)) {
  [NativeDisplayWake]::SetCursorPos($cursor.X + 24, $cursor.Y + 24) | Out-Null
  Start-Sleep -Milliseconds 120
  [NativeDisplayWake]::SetCursorPos($cursor.X, $cursor.Y) | Out-Null
  Start-Sleep -Milliseconds 120
}

for ($i = 0; $i -lt 3; $i++) {
  [NativeDisplayWake]::mouse_event(0x0001, 12, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [NativeDisplayWake]::mouse_event(0x0001, 0, 12, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [NativeDisplayWake]::mouse_event(0x0001, 4294967284, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 60
  [NativeDisplayWake]::mouse_event(0x0001, 0, 4294967284, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 90
}

[NativeDisplayWake]::keybd_event(0x10, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[NativeDisplayWake]::keybd_event(0x10, 0, 0x0002, [UIntPtr]::Zero)
[NativeDisplayWake]::SetThreadExecutionState([uint32]2147483648) | Out-Null
`);
  }
  return { powered: action };
}

export async function captureScreenshot(config, args) {
  const probeScript = `
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.Screen]::AllScreens.Count
`;
  const { stdout: countStdout } = await execFileAsync(
    WINDOWS_POWERSHELL_BIN,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", probeScript],
    { timeout: 5000, maxBuffer: 256 * 1024 },
  );
  const displayCount = Math.max(1, Number.parseInt(String(countStdout || "").trim(), 10) || 1);
  const stagedPaths =
    displayCount === 1
      ? [await allocateScreenshotPath(config, args?.file_name)]
      : await allocateScreenshotPaths(config, args?.file_name, displayCount);
  const stagedWindowsPaths = stagedPaths.map((entry) => toWindowsPath(entry));
  if (stagedWindowsPaths.some((entry) => !entry)) {
    const err = new Error("Unable to translate staging path for screenshot export");
    err.code = "invalid_argument";
    throw err;
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$screens = [System.Windows.Forms.Screen]::AllScreens;
$targets = @(
${stagedWindowsPaths.map((entry) => `  '${entry.replace(/'/g, "''")}'`).join(",\n")}
);
for ($i = 0; $i -lt $screens.Length; $i++) {
  $screen = $screens[$i];
  $target = $targets[$i];
  $bounds = $screen.Bounds;
  $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap);
  $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
  $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png);
  $graphics.Dispose();
  $bitmap.Dispose();
}
`;
  await runPowerShell(script);
  const stats = await Promise.all(stagedPaths.map((entry) => fs.stat(entry)));
  return {
    path: stagedPaths[0],
    paths: stagedPaths,
    file_name: path.basename(stagedPaths[0]),
    size: stats.reduce((sum, stat) => sum + stat.size, 0),
    displays: stagedPaths.map((entry, index) => ({
      path: entry,
      primary: index === 0,
    })),
  };
}
