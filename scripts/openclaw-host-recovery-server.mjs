import http from "node:http";
import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveAuthorizedBridgeProfile } from "../src/recovery-profile-selection.mjs";

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
const DEFAULT_STAGE_BRIDGE_SYSTEMD_UNIT = "openclaw-host-bridge-stage.service";
const DEFAULT_STAGE_BRIDGE_SESSION = "openclaw-host-bridge-stage";
const DEFAULT_STAGE_BRIDGE_PORT = 48731;
const DEFAULT_BRIDGE_TOKEN_ENV = "OPENCLAW_HOST_BRIDGE_TOKEN";

function resolveBridgeRoot() {
  return process.env.OPENCLAW_HOST_BRIDGE_ROOT || path.resolve(SCRIPT_DIR, "..");
}

function resolveOpenClawHomeDir() {
  return process.env.OPENCLAW_HOME || path.join(process.env.HOME || os.homedir(), ".openclaw");
}

function resolveOpenClawConfigPath() {
  if (process.env.OPENCLAW_CONFIG_PATH) {
    return path.resolve(process.env.OPENCLAW_CONFIG_PATH);
  }
  return path.join(resolveOpenClawHomeDir(), "openclaw.json");
}

function resolveStageOpenClawConfigPath() {
  if (process.env.OPENCLAW_STAGE_OPENCLAW_CONFIG_PATH) {
    return path.resolve(process.env.OPENCLAW_STAGE_OPENCLAW_CONFIG_PATH);
  }
  return path.join(process.env.HOME || os.homedir(), ".openclaw-stage", "openclaw.stage.k3s.json");
}

function resolveBridgeConfigPath(root) {
  if (process.env.OPENCLAW_HOST_BRIDGE_CONFIG) {
    return path.resolve(process.env.OPENCLAW_HOST_BRIDGE_CONFIG);
  }
  const localPath = path.join(root, "config", "policy.local.json");
  if (fs.existsSync(localPath)) {
    return localPath;
  }
  return path.join(resolveOpenClawHomeDir(), "workspace-telegram-fast", "policy.local.json");
}

function resolveStageBridgeConfigPath(root) {
  if (process.env.OPENCLAW_STAGE_HOST_BRIDGE_CONFIG) {
    return path.resolve(process.env.OPENCLAW_STAGE_HOST_BRIDGE_CONFIG);
  }
  if (process.env.OPENCLAW_STAGE_BRIDGE_POLICY_PATH) {
    return path.resolve(process.env.OPENCLAW_STAGE_BRIDGE_POLICY_PATH);
  }
  return path.join(root, "config", "policy.stage.local.json");
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

function resolveGatewayToken(profileId, tokenEnv, openclawConfig) {
  const envCandidates =
    profileId === "stage"
      ? [
          ["OPENCLAW_STAGE_GATEWAY_TOKEN", process.env.OPENCLAW_STAGE_GATEWAY_TOKEN],
          ["OPENCLAW_STAGE_HOST_BRIDGE_TOKEN", process.env.OPENCLAW_STAGE_HOST_BRIDGE_TOKEN],
        ]
      : [
          ["OPENCLAW_GATEWAY_TOKEN", process.env.OPENCLAW_GATEWAY_TOKEN],
          [tokenEnv, process.env[tokenEnv]],
          ["OPENCLAW_HOST_BRIDGE_TOKEN", process.env.OPENCLAW_HOST_BRIDGE_TOKEN],
        ];

  for (const [source, value] of envCandidates) {
    if (typeof value === "string" && value.trim()) {
      return { token: value.trim(), tokenSource: `env.${source}` };
    }
  }

  if (typeof openclawConfig?.gateway?.auth?.token === "string" && openclawConfig.gateway.auth.token.trim()) {
    return {
      token: openclawConfig.gateway.auth.token.trim(),
      tokenSource:
        profileId === "stage"
          ? "openclaw.stage.k3s.json.gateway.auth.token"
          : "openclaw.json.gateway.auth.token",
    };
  }

  return { token: "", tokenSource: "missing" };
}

function resolveBridgePort(bridgePolicy, fallbackPort) {
  const rawPort = bridgePolicy?.listen?.port ?? bridgePolicy?.listener?.port;
  const port = Number(rawPort);
  return Number.isFinite(port) && port > 0 ? port : fallbackPort;
}

function loadBridgeProfile({
  id,
  root,
  bridgeConfigPath,
  openclawConfigPath,
  bridgeHealthUrl,
  session,
  bridgeSystemdUnit,
  bridgePidPath,
  fallbackPort,
}) {
  const bridgePolicy = readJson(bridgeConfigPath);
  const openclawConfig = readJson(openclawConfigPath);
  const tokenEnv =
    typeof bridgePolicy?.auth?.token_env === "string" && bridgePolicy.auth.token_env.trim()
      ? bridgePolicy.auth.token_env.trim()
      : DEFAULT_BRIDGE_TOKEN_ENV;
  const { token, tokenSource } = resolveGatewayToken(id, tokenEnv, openclawConfig);
  const bridgePort = resolveBridgePort(bridgePolicy, fallbackPort);
  return {
    id,
    available: fs.existsSync(bridgeConfigPath) && fs.existsSync(openclawConfigPath),
    token,
    tokenSource,
    tokenEnv,
    bridgeUrl: bridgeHealthUrl || `http://127.0.0.1:${bridgePort}/healthz`,
    bridgePort,
    session,
    bridgeSystemdUnit,
    bridgeConfigPath,
    openclawConfigPath,
    bridgePidPath,
  };
}

function loadRuntimeConfig() {
  const root = resolveBridgeRoot();
  return {
    port: Number(process.env.OPENCLAW_HOST_RECOVERY_PORT || 48722),
    host: process.env.OPENCLAW_HOST_RECOVERY_HOST || "0.0.0.0",
    recoverySession:
      process.env.OPENCLAW_HOST_RECOVERY_TMUX_SESSION || "openclaw-host-recovery",
    recoverySystemdUnit:
      process.env.OPENCLAW_HOST_RECOVERY_SYSTEMD_UNIT || "openclaw-host-recovery.service",
    recoveryPidPath:
      process.env.OPENCLAW_HOST_RECOVERY_PID_PATH || path.join(root, "tmp", "openclaw-host-recovery.pid"),
    root,
    bridgeProfiles: {
      prod: loadBridgeProfile({
        id: "prod",
        root,
        bridgeConfigPath: resolveBridgeConfigPath(root),
        openclawConfigPath: resolveOpenClawConfigPath(),
        bridgeHealthUrl: process.env.OPENCLAW_HOST_BRIDGE_HEALTH_URL,
        session: process.env.OPENCLAW_HOST_BRIDGE_TMUX_SESSION || "openclaw-host-bridge",
        bridgeSystemdUnit:
          process.env.OPENCLAW_HOST_BRIDGE_SYSTEMD_UNIT || "openclaw-host-bridge.service",
        bridgePidPath:
          process.env.OPENCLAW_HOST_BRIDGE_PID_PATH || path.join(root, "tmp", "openclaw-host-bridge.pid"),
        fallbackPort: 48721,
      }),
      stage: loadBridgeProfile({
        id: "stage",
        root,
        bridgeConfigPath: resolveStageBridgeConfigPath(root),
        openclawConfigPath: resolveStageOpenClawConfigPath(),
        bridgeHealthUrl: process.env.OPENCLAW_STAGE_BRIDGE_HEALTH_URL,
        session: process.env.OPENCLAW_STAGE_BRIDGE_TMUX_SESSION || DEFAULT_STAGE_BRIDGE_SESSION,
        bridgeSystemdUnit:
          process.env.OPENCLAW_STAGE_BRIDGE_SYSTEMD_UNIT || DEFAULT_STAGE_BRIDGE_SYSTEMD_UNIT,
        bridgePidPath:
          process.env.OPENCLAW_STAGE_BRIDGE_PID_PATH
          || path.join(root, "tmp", "openclaw-host-bridge-stage.pid"),
        fallbackPort: DEFAULT_STAGE_BRIDGE_PORT,
      }),
    },
  };
}

const runtimeConfig = loadRuntimeConfig();
const PORT = runtimeConfig.port;
const HOST = runtimeConfig.host;
const RECOVERY_SESSION = runtimeConfig.recoverySession;
const ROOT = runtimeConfig.root;
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

function availableBridgeProfiles() {
  return Object.values(runtimeConfig.bridgeProfiles).filter((profile) => profile.available);
}

async function checkBridge(profile) {
  try {
    const response = await fetch(profile.bridgeUrl, { signal: AbortSignal.timeout(5000) });
    const body = await response.text();
    return { ok: response.ok, status: response.status, body: body.slice(0, 300) };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

async function checkTmuxSession(sessionName) {
  try {
    await execFileAsync("tmux", ["has-session", "-t", sessionName]);
    return { ok: true, running: true, session: sessionName, source: "tmux" };
  } catch (error) {
    return { ok: false, running: false, session: sessionName, source: "tmux", error: toErrorMessage(error) };
  }
}

async function checkSystemdUnit(unitName) {
  let activeState = "";
  let activeError = "";
  try {
    const { stdout: activeStdout } = await execFileAsync("systemctl", ["is-active", unitName]);
    activeState = String(activeStdout || "").trim();
  } catch (error) {
    activeState = String(error?.stdout || "").trim();
    activeError = toErrorMessage(error);
  }

  let properties = {};
  let showError = "";
  try {
    const { stdout: showStdout } = await execFileAsync("systemctl", [
      "show",
      unitName,
      "--property=SubState,MainPID,LoadState,UnitFileState",
    ]);
    properties = Object.fromEntries(
      String(showStdout || "")
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const pivot = entry.indexOf("=");
          if (pivot === -1) {
            return [entry, ""];
          }
          return [entry.slice(0, pivot), entry.slice(pivot + 1)];
        }),
    );
  } catch (error) {
    showError = toErrorMessage(error);
  }

  const subState = typeof properties.SubState === "string" ? properties.SubState : "";
  const mainPid = typeof properties.MainPID === "string" ? properties.MainPID : "";
  const loadState = typeof properties.LoadState === "string" ? properties.LoadState : "";
  const unitFileState =
    typeof properties.UnitFileState === "string" ? properties.UnitFileState : "";
  return {
    ok: activeState === "active",
    running: activeState === "active",
    source: "systemd",
    unit: unitName,
    activeState,
    subState,
    mainPid: mainPid ? Number.parseInt(mainPid, 10) || null : null,
    loadState,
    unitFileState,
    error: activeError || showError || undefined,
  };
}

async function checkSupervisor(sessionName, systemdUnit) {
  const systemd = await checkSystemdUnit(systemdUnit);
  if (systemd.loadState && systemd.loadState !== "not-found") {
    return {
      ok: systemd.running,
      running: systemd.running,
      session: sessionName,
      source: "systemd",
      unit: systemdUnit,
      activeState: systemd.activeState,
      subState: systemd.subState,
      mainPid: systemd.mainPid,
      loadState: systemd.loadState,
      unitFileState: systemd.unitFileState,
      error: systemd.error,
    };
  }
  const tmux = await checkTmuxSession(sessionName);
  return {
    ...tmux,
    unit: systemdUnit,
    systemd,
  };
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

async function buildDiagnostics(profile) {
  const bridge = await checkBridge(profile);
  const bridgePid = readPidStatus(profile.bridgePidPath);
  const recoveryPid = readPidStatus(runtimeConfig.recoveryPidPath);
  const bridgeSession = await checkSupervisor(profile.session, profile.bridgeSystemdUnit);
  const recoverySession = await checkSupervisor(RECOVERY_SESSION, runtimeConfig.recoverySystemdUnit);
  return {
    timestamp: new Date().toISOString(),
    targetProfile: profile.id,
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
      tokenLoaded: Boolean(profile.token),
      tokenEnv: profile.tokenEnv,
      tokenSource: profile.tokenSource,
      authorizedProfile: profile.id,
    },
    config: {
      root: ROOT,
      bridgeConfigPath: profile.bridgeConfigPath,
      openclawConfigPath: profile.openclawConfigPath,
      bridgeUrl: profile.bridgeUrl,
      bridgePort: profile.bridgePort,
      recoveryUrl: `http://${HOST}:${PORT}`,
      bridgeSession: profile.session,
      bridgeSystemdUnit: profile.bridgeSystemdUnit,
      recoverySession: RECOVERY_SESSION,
      availableProfiles: availableBridgeProfiles().map((entry) => entry.id),
    },
  };
}

function summarizeDiagnostics(diagnostics) {
  const issues = [];
  if (!diagnostics.auth.tokenLoaded) {
    issues.push({ code: "recovery_auth_missing", message: "Recovery auth token is not loaded." });
  }
  if (!diagnostics.sessions.bridge.running && !diagnostics.pids.bridge.running) {
    issues.push({ code: "bridge_supervisor_down", message: "Bridge supervisor is not running." });
  }
  if (!diagnostics.pids.bridge.running) {
    issues.push({ code: "bridge_pid_down", message: "Bridge pid file does not point to a running process." });
  }
  if (!diagnostics.bridge.ok) {
    issues.push({ code: "bridge_unreachable", message: "Bridge health check failed." });
  }
  if (!diagnostics.sessions.recovery.running && !diagnostics.pids.recovery.running) {
    issues.push({ code: "recovery_supervisor_down", message: "Recovery supervisor is not running." });
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

async function repairNetwork(profile) {
  if (profile.id === "stage") {
    return {
      ok: true,
      skipped: true,
      note: "Stage bridge does not use the Windows localhost portproxy repair path.",
    };
  }
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

async function restartBridge(profile) {
  if (!ROOT || !profile.bridgeConfigPath || !profile.openclawConfigPath || !profile.token) {
    throw new Error("Missing required bridge restart environment");
  }
  const systemd = await checkSystemdUnit(profile.bridgeSystemdUnit);
  if (systemd.loadState && systemd.loadState !== "not-found") {
    const action = systemd.running ? "restart" : "start";
    await execFileAsync("systemctl", [action, profile.bridgeSystemdUnit]);
    return { ok: true, method: "systemd", unit: profile.bridgeSystemdUnit, action, profile: profile.id };
  }

  await execFileAsync("tmux", ["kill-session", "-t", profile.session]).catch(() => {});
  await execFileAsync(`${ROOT}/scripts/legacy/start-openclaw-host-bridge-tmux.sh`, [], {
    env: {
      ...process.env,
      OPENCLAW_HOST_BRIDGE_ROOT: ROOT,
      OPENCLAW_HOST_BRIDGE_CONFIG: profile.bridgeConfigPath,
      OPENCLAW_CONFIG_PATH: profile.openclawConfigPath,
      OPENCLAW_GATEWAY_TOKEN: profile.token,
      OPENCLAW_HOST_BRIDGE_TMUX_SESSION: profile.session,
    },
  });
  return { ok: true, method: "tmux", session: profile.session, profile: profile.id };
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
  throw new Error(
    "Gateway restart is not owned by host recovery on the current Platform-Core model. Use the OpenClaw lifecycle controls in platform-engineering instead.",
  );
}

async function handleSelfHeal(action, profile) {
  const steps = [];
  if (action === "bridge_restart") {
    steps.push(await executeStep("bridge_restart", () => restartBridge(profile)));
  } else if (action === "bridge_repair_network") {
    steps.push(await executeStep("bridge_repair_network", () => repairNetwork(profile)));
  } else if (action === "gateway_restart") {
    steps.push(await executeStep("gateway_restart", gatewayRestart));
  } else if (action === "full_host_control_repair") {
    steps.push(await executeStep("bridge_restart", () => restartBridge(profile)));
    steps.push(await executeStep("bridge_repair_network", () => repairNetwork(profile)));
  } else if (action !== "recheck_health" && action !== "diagnostics") {
    throw new Error(`Unsupported self-heal action: ${action}`);
  }
  const diagnostics = await buildDiagnostics(profile);
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
    targetProfile: profile.id,
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
      const body = await readBody(req);
      const selectedProfile = resolveAuthorizedBridgeProfile(
        getAuthToken(req),
        body,
        availableBridgeProfiles(),
      );
      if (!selectedProfile.ok) {
        return json(res, selectedProfile.status, { ok: false, error: selectedProfile.error });
      }
      const action = typeof body?.action === "string" ? body.action : "recheck_health";
      const result = await handleSelfHeal(action, selectedProfile.profile);
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
  const profiles = availableBridgeProfiles()
    .map((profile) => `${profile.id}:${profile.bridgeSystemdUnit}`)
    .join(", ");
  console.log(
    `openclaw-host-recovery listening on http://${HOST}:${PORT} (profiles=${profiles || "none"})`,
  );
});
