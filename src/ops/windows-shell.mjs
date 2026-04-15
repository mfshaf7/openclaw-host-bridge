import fs from "node:fs";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFileCallback);
const WINDOWS_EXEC_HELPER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../scripts/run_windows_command.py",
);

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

export async function execWindowsCommand(binary, args = [], options = {}) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payloadPath = path.posix.join('/tmp', `openclaw-host-bridge-${nonce}.json`);
  fs.writeFileSync(
    payloadPath,
    JSON.stringify({
      binary,
      args: args.map((entry) => String(entry ?? "")),
    }),
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );
  try {
    return await execFileAsync(
      '/usr/bin/python3',
      [WINDOWS_EXEC_HELPER, payloadPath],
      buildWindowsExecOptions(options),
    );
  } finally {
    fs.rmSync(payloadPath, { force: true });
  }
}

export async function execWindowsPowerShell(args = [], options = {}) {
  return await execWindowsCommand(resolveWindowsPowerShellBinary(), args, options);
}
