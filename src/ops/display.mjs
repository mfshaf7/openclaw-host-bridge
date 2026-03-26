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
