import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function runPowerShell(command) {
  await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ]);
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
  public static extern IntPtr SendMessage(IntPtr hWnd, UInt32 Msg, IntPtr wParam, IntPtr lParam);
}
"@;
[NativeMonitorPower]::SendMessage([intptr]0xffff, 0x0112, [intptr]0xF170, [intptr]2) | Out-Null
`);
  } else {
    await runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.SendKeys]::SendWait("{SCROLLLOCK}");
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("{SCROLLLOCK}")
`);
  }
  return { powered: action };
}

export async function captureScreenshot(config, args) {
  const stagedPath = await allocateScreenshotPath(config, args?.file_name);
  const stagedWindowsPath = toWindowsPath(stagedPath);
  if (!stagedWindowsPath) {
    const err = new Error("Unable to translate staging path for screenshot export");
    err.code = "invalid_argument";
    throw err;
  }

  const script = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size);
$bitmap.Save('${stagedWindowsPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png);
$graphics.Dispose();
$bitmap.Dispose();
`;
  await runPowerShell(script);
  const stat = await fs.stat(stagedPath);
  return {
    path: stagedPath,
    paths: [stagedPath],
    file_name: path.basename(stagedPath),
    size: stat.size,
    displays: [
      {
        path: stagedPath,
        primary: true,
      },
    ],
  };
}
