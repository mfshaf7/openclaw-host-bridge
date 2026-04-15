import fs from "node:fs";
import path from "node:path";

const WINDOWS_POWERSHELL_CANDIDATES = [
  process.env.OPENCLAW_WINDOWS_POWERSHELL,
  process.env.OPENCLAW_POWERSHELL_BIN,
  "powershell.exe",
  "pwsh.exe",
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
  "/mnt/c/Program Files/PowerShell/7-preview/pwsh.exe",
].filter((entry) => typeof entry === "string" && entry.trim());

export function resolveWindowsPowerShellBinary() {
  for (const candidate of WINDOWS_POWERSHELL_CANDIDATES) {
    if (candidate.includes("/") || candidate.includes("\\")) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      continue;
    }
    return candidate;
  }
  return "powershell.exe";
}

export function resolveActiveWslInteropSocket() {
  const current = process.env.WSL_INTEROP;
  if (typeof current === "string" && current.trim() && fs.existsSync(current.trim())) {
    return current.trim();
  }

  const interopDir = "/run/WSL";
  if (!fs.existsSync(interopDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(interopDir)
    .filter((entry) => entry.endsWith("_interop"))
    .map((entry) => path.posix.join(interopDir, entry))
    .filter((entry) => fs.existsSync(entry))
    .map((entry) => ({ entry, mtimeMs: fs.statSync(entry).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return candidates[0]?.entry ?? null;
}

export function buildWindowsExecOptions(options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  const interop = resolveActiveWslInteropSocket();
  if (interop) {
    env.WSL_INTEROP = interop;
  }
  return {
    ...options,
    env,
  };
}
