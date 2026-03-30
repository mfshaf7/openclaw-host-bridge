import fs from "node:fs";

const WINDOWS_POWERSHELL_CANDIDATES = [
  process.env.OPENCLAW_WINDOWS_POWERSHELL,
  process.env.OPENCLAW_POWERSHELL_BIN,
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
  "/mnt/c/Program Files/PowerShell/7-preview/pwsh.exe",
  "powershell.exe",
  "pwsh.exe",
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
