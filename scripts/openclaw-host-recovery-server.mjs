import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execFileAsync = promisify(execFile);

const PORT = Number(process.env.OPENCLAW_HOST_RECOVERY_PORT || 48722);
const HOST = process.env.OPENCLAW_HOST_RECOVERY_HOST || "0.0.0.0";
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_HOST_BRIDGE_TOKEN || "";
const BRIDGE_URL = process.env.OPENCLAW_HOST_BRIDGE_HEALTH_URL || "http://127.0.0.1:48721/healthz";
const SESSION = process.env.OPENCLAW_HOST_BRIDGE_TMUX_SESSION || "openclaw-host-bridge";
const ROOT = process.env.OPENCLAW_HOST_BRIDGE_ROOT || "";
const CONFIG_PATH = process.env.OPENCLAW_HOST_BRIDGE_CONFIG || "";
const OPENCLAW_CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || "";

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
    return { ok: false, error: String(error) };
  }
}

async function runPowerShell(command) {
  const { stdout } = await execFileAsync("powershell.exe", [
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
    steps.push({ step: "bridge_restart", ...(await restartBridge()) });
  } else if (action === "bridge_repair_network") {
    steps.push({ step: "bridge_repair_network", ...(await repairNetwork()) });
  } else if (action === "gateway_restart") {
    steps.push({ step: "gateway_restart", ...(await gatewayRestart()) });
  } else if (action === "full_pc_control_repair") {
    steps.push({ step: "bridge_restart", ...(await restartBridge()) });
    steps.push({ step: "bridge_repair_network", ...(await repairNetwork()) });
  } else if (action !== "recheck_health") {
    throw new Error(`Unsupported self-heal action: ${action}`);
  }
  const bridge = await checkBridge();
  const overallOk = steps.every((entry) => entry.ok !== false) && bridge.ok === true;
  return {
    ok: overallOk,
    action,
    bridge,
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
  console.log(`openclaw-host-recovery listening on http://${HOST}:${PORT}`);
});
