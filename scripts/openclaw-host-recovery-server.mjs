import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WINDOWS_POWERSHELL_CANDIDATES = [
  process.env.OPENCLAW_WINDOWS_POWERSHELL,
  process.env.OPENCLAW_POWERSHELL_BIN,
  "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/WINDOWS/System32/WindowsPowerShell/v1.0/powershell.exe",
  "/mnt/c/Program Files/PowerShell/7/pwsh.exe",
  "/mnt/c/Program Files/PowerShell/7-preview/pwsh.exe",
  "powershell.exe",
  "pwsh.exe",
].filter((entry) => typeof entry === "string" && entry.trim());

function resolveBridgeRoot() {
  return process.env.OPENCLAW_HOST_BRIDGE_ROOT || path.resolve(SCRIPT_DIR, "..");
}

function resolveOpenClawConfigPath() {
  if (process.env.OPENCLAW_CONFIG_PATH) {
    return path.resolve(process.env.OPENCLAW_CONFIG_PATH);
  }
  const openclawHome =
    process.env.OPENCLAW_HOME || path.join(process.env.HOME || os.homedir(), ".openclaw");
  return path.join(openclawHome, "openclaw.json");
}

function resolveBridgeConfigPath(root) {
  if (process.env.OPENCLAW_HOST_BRIDGE_CONFIG) {
    return path.resolve(process.env.OPENCLAW_HOST_BRIDGE_CONFIG);
  }
  const localPath = path.join(root, "config", "policy.local.json");
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  const openclawHome =
    process.env.OPENCLAW_HOME || path.join(process.env.HOME || os.homedir(), ".openclaw");
  return path.join(openclawHome, "workspace-telegram-fast", "policy.local.json");
}

function readJson(pathname) {
  if (!pathname || !fs.existsSync(pathname)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(pathname, "utf8"));
}

function resolveWindowsPowerShellBinary() {
  for (const candidate of DEFAULT_WINDOWS_POWERSHELL_CANDIDATES) {
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

function loadRuntimeConfig() {
  const root = resolveBridgeRoot();
  const bridgeConfigPath = resolveBridgeConfigPath(root);
  const openclawConfigPath = resolveOpenClawConfigPath();
  const bridgePolicy = readJson(bridgeConfigPath);
  const openclawConfig = readJson(openclawConfigPath);
  const tokenEnv = bridgePolicy?.auth?.token_env || "OPENCLAW_HOST_BRIDGE_TOKEN";
  let tokenSource = "missing";
  let token = "";
  if (process.env.OPENCLAW_GATEWAY_TOKEN) {
    token = process.env.OPENCLAW_GATEWAY_TOKEN;
    tokenSource = "env.OPENCLAW_GATEWAY_TOKEN";
  } else if (process.env[tokenEnv]) {
    token = process.env[tokenEnv];
    tokenSource = `env.${tokenEnv}`;
  } else if (process.env.OPENCLAW_HOST_BRIDGE_TOKEN) {
    token = process.env.OPENCLAW_HOST_BRIDGE_TOKEN;
    tokenSource = "env.OPENCLAW_HOST_BRIDGE_TOKEN";
  } else if (openclawConfig?.gateway?.auth?.token) {
    token = openclawConfig.gateway.auth.token;
    tokenSource = "openclaw.json.gateway.auth.token";
  }
  const bridgePort = Number(bridgePolicy?.listen?.port || 48721);
  const recoverySession =
    process.env.OPENCLAW_HOST_RECOVERY_TMUX_SESSION || "openclaw-host-recovery";
  return {
    port: Number(process.env.OPENCLAW_HOST_RECOVERY_PORT || 48722),
    host: process.env.OPENCLAW_HOST_RECOVERY_HOST || "0.0.0.0",
    token,
    tokenSource,
    tokenEnv,
    bridgeUrl:
      process.env.OPENCLAW_HOST_BRIDGE_HEALTH_URL || `http://127.0.0.1:${bridgePort}/healthz`,
    bridgePort,
    session: process.env.OPENCLAW_HOST_BRIDGE_TMUX_SESSION || "openclaw-host-bridge",
    recoverySession,
    root,
    bridgeConfigPath,
    openclawConfigPath,
  };
}

const runtimeConfig = loadRuntimeConfig();
const PORT = runtimeConfig.port;
const HOST = runtimeConfig.host;
const TOKEN = runtimeConfig.token;
const BRIDGE_URL = runtimeConfig.bridgeUrl;
const SESSION = runtimeConfig.session;
const RECOVERY_SESSION = runtimeConfig.recoverySession;
const ROOT = runtimeConfig.root;
const CONFIG_PATH = runtimeConfig.bridgeConfigPath;
const OPENCLAW_CONFIG_PATH = runtimeConfig.openclawConfigPath;
const WINDOWS_POWERSHELL_BIN = resolveWindowsPowerShellBinary();

function toErrorMessage(error) {
  return String(error?.message || error);
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(`${JSON.stringify(body)}\n`);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || "";
}

async function checkBridge() {
  try {
    const response = await fetch(BRIDGE_URL, { signal: AbortSignal.timeout(5000) });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 300) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function checkTmuxSession(sessionName) {
  try {
    await execFileAsync("tmux", ["has-session", "-t", sessionName]);
    return { ok: true, running: true, session: sessionName };
  } catch (error) {
    return { ok: false, running: false, session: sessionName, error: toErrorMessage(error) };
  }
}

function readPidStatus(pidPath) {
  if (!pidPath || !fs.existsSync(pidPath)) {
    return { ok: false, pid: null, path: pidPath, running: false, error: "pid_file_missing" };
  }
  const raw = fs.readFileSync(pidPath, "utf8").trim();
  const pid = Number.parseInt(raw, 10);
  if (!Number.isFinite(pid) || pid <= 0) {
    return { ok: false, pid: null, path: pidPath, running: false, error: "pid_invalid" };
  }
  try {
    process.kill(pid, 0);
    return { ok: true, pid, path: pidPath, running: true };
  } catch (error) {
    return { ok: false, pid, path: pidPath, running: false, error: toErrorMessage(error) };
  }
}

async function buildDiagnostics() {
  const bridge = await checkBridge();
  const bridgePid = readPidStatus(path.join(ROOT, "tmp", "openclaw-host-bridge.pid"));
  const recoveryPid = readPidStatus(path.join(ROOT, "tmp", "openclaw-host-recovery.pid"));
  const bridgeSession = await checkTmuxSession(SESSION);
  const recoverySession = await checkTmuxSession(RECOVERY_SESSION);
  return {
    timestamp: new Date().toISOString(),
    bridge,
    recovery: {
      ok: true,
      service: "openclaw-host-recovery",
      host: HOST,
      port: PORT,
      pid: process.pid,
    },
    sessions: {
      bridge: bridgeSession,
      recovery: recoverySession,
    },
    pids: {
      bridge: bridgePid,
      recovery: recoveryPid,
    },
    auth: {
      tokenLoaded: Boolean(TOKEN),
      tokenEnv: runtimeConfig.tokenEnv,
      tokenSource: runtimeConfig.tokenSource,
    },
    config: {
      root: ROOT,
      bridgeConfigPath: CONFIG_PATH,
      openclawConfigPath: OPENCLAW_CONFIG_PATH,
      bridgeUrl: BRIDGE_URL,
      bridgePort: runtimeConfig.bridgePort,
      recoveryUrl: `http://${HOST}:${PORT}`,
      bridgeSession: SESSION,
      recoverySession: RECOVERY_SESSION,
    },
  };
}

function summarizeDiagnostics(diagnostics) {
  const issues = [];
  if (!diagnostics.auth.tokenLoaded) {
    issues.push({ code: "recovery_auth_missing", message: "Recovery auth token is not loaded." });
  }
  if (!diagnostics.sessions.bridge.running && !diagnostics.pids.bridge.running) {
    issues.push({ code: "bridge_session_down", message: "Bridge tmux session is not running." });
  }
  if (!diagnostics.pids.bridge.running) {
    issues.push({ code: "bridge_pid_down", message: "Bridge pid file does not point to a running process." });
  }
  if (!diagnostics.bridge.ok) {
    issues.push({ code: "bridge_unreachable", message: "Bridge health check failed." });
  }
  if (!diagnostics.sessions.recovery.running && !diagnostics.pids.recovery.running) {
    issues.push({ code: "recovery_session_down", message: "Recovery tmux session is not running." });
  }
  if (!diagnostics.pids.recovery.running) {
    issues.push({ code: "recovery_pid_down", message: "Recovery pid file does not point to a running process." });
  }
  return {
    healthy: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}

async function runPowerShell(command) {
  const { stdout } = await execFileAsync(WINDOWS_POWERSHELL_BIN, [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    command,
  ]);
  return stdout;
}

async function repairNetwork() {
  const wslIp = (await execFileAsync("hostname", ["-I"])).stdout.trim().split(/\s+/)[0] || "";
  if (!wslIp) {
    throw new Error("Unable to determine WSL IP");
  }
  await runPowerShell(`
netsh interface portproxy delete v4tov4 listenport=48721 listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=48721 listenaddress=0.0.0.0 connectport=48721 connectaddress=${wslIp}
netsh interface portproxy delete v4tov4 listenport=48722 listenaddress=0.0.0.0 | Out-Null
netsh interface portproxy add v4tov4 listenport=48722 listenaddress=0.0.0.0 connectport=48722 connectaddress=${wslIp}
if (-not (Get-NetFirewallRule -DisplayName 'OpenClaw host bridge 48721' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'OpenClaw host bridge 48721' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 48721 | Out-Null
}
if (-not (Get-NetFirewallRule -DisplayName 'OpenClaw host recovery 48722' -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName 'OpenClaw host recovery 48722' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 48722 | Out-Null
}
`);
  return { ok: true, wslIp };
}

async function restartBridge() {
  if (!ROOT || !CONFIG_PATH || !OPENCLAW_CONFIG_PATH || !TOKEN) {
    throw new Error("Missing required bridge restart environment");
  }
  await execFileAsync("tmux", ["kill-session", "-t", SESSION]).catch(() => {});
  await execFileAsync(`${ROOT}/scripts/start-openclaw-host-bridge-tmux.sh`, [], {
    env: {
      ...process.env,
      OPENCLAW_HOST_BRIDGE_ROOT: ROOT,
      OPENCLAW_HOST_BRIDGE_CONFIG: CONFIG_PATH,
      OPENCLAW_CONFIG_PATH,
      OPENCLAW_GATEWAY_TOKEN: TOKEN,
      OPENCLAW_HOST_BRIDGE_TMUX_SESSION: SESSION,
    },
  });
  return { ok: true, session: SESSION };
}

async function executeStep(step, operation) {
  try {
    const details = await operation();
    return { step, ok: true, code: `${step}_ok`, ...details };
  } catch (error) {
    return {
      step,
      ok: false,
      code: `${step}_failed`,
      error: toErrorMessage(error),
    };
  }
}

async function gatewayRestart() {
  try {
    await execFileAsync("docker", ["restart", "upstream-openclaw-openclaw-gateway-1"]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

async function handleSelfHeal(action) {
  const steps = [];
  if (action === "bridge_restart") {
    steps.push(await executeStep("bridge_restart", restartBridge));
  } else if (action === "bridge_repair_network") {
    steps.push(await executeStep("bridge_repair_network", repairNetwork));
  } else if (action === "gateway_restart") {
    steps.push(await executeStep("gateway_restart", gatewayRestart));
  } else if (action === "full_host_control_repair") {
    steps.push(await executeStep("bridge_restart", restartBridge));
    steps.push(await executeStep("bridge_repair_network", repairNetwork));
  } else if (action !== "recheck_health" && action !== "diagnostics") {
    throw new Error(`Unsupported self-heal action: ${action}`);
  }
  const diagnostics = await buildDiagnostics();
  const summary = summarizeDiagnostics(diagnostics);
  const overallOk =
    action === "diagnostics"
      ? true
      : steps.every((entry) => entry.ok !== false) && summary.healthy;
  return {
    ok: overallOk,
    action,
    summary,
    diagnostics,
    steps,
    host: {
      hostname: os.hostname(),
    },
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/healthz" && req.method === "GET") {
      return json(res, 200, { ok: true, service: "openclaw-host-recovery" });
    }
    if (req.url === "/v1/self-heal" && req.method === "POST") {
      if (!TOKEN || getAuthToken(req) !== TOKEN) {
        return json(res, 401, { ok: false, error: { code: "unauthorized", message: "Unauthorized" } });
      }
      const body = await readBody(req);
      const action = typeof body?.action === "string" ? body.action : "recheck_health";
      const result = await handleSelfHeal(action);
      const status = result.ok ? 200 : 500;
      return json(res, status, { ok: result.ok, result });
    }
    return json(res, 404, { ok: false, error: { code: "not_found", message: "Not found" } });
  } catch (error) {
    return json(res, 500, {
      ok: false,
      error: { code: "internal_error", message: String(error?.message || error) },
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log(
    `openclaw-host-recovery listening on http://${HOST}:${PORT} (token_env=${runtimeConfig.tokenEnv}, token_source=${runtimeConfig.tokenSource}, config=${CONFIG_PATH})`,
  );
});
