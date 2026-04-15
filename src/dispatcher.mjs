import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { requirePermission } from "./policy.mjs";
import { healthCheck } from "./ops/health.mjs";
import {
  addAllowedRoot,
  hostDiscoveryBrowse,
  hostDiscoveryOverview,
  listAllowedRoots,
  removeAllowedRoot,
} from "./ops/admin.mjs";
import { captureScreenshot, monitorPower } from "./ops/display.mjs";
import {
  listDirectory,
  makeDirectory,
  movePath,
  quarantinePath,
  readMetadata,
  searchFiles,
  stageForTelegram,
  zipForExport,
} from "./ops/fs.mjs";
import { inspectTab, listTabs } from "./ops/browser.mjs";

const CHILD_DISPATCH_OPERATIONS = new Set(["display.monitor_power", "display.screenshot"]);
const CHILD_DISPATCH_SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/run_bridge_operation_isolated.sh",
);

const HANDLERS = {
  "health.check": healthCheck,
  "config.allowed_roots.list": listAllowedRoots,
  "config.allowed_roots.add": addAllowedRoot,
  "config.allowed_roots.remove": removeAllowedRoot,
  "config.host_discovery.overview": hostDiscoveryOverview,
  "config.host_discovery.browse": hostDiscoveryBrowse,
  "display.monitor_power": monitorPower,
  "display.screenshot": captureScreenshot,
  "fs.list": listDirectory,
  "fs.search": searchFiles,
  "fs.read_meta": readMetadata,
  "fs.mkdir": makeDirectory,
  "fs.move": movePath,
  "fs.quarantine": quarantinePath,
  "fs.zip_for_export": zipForExport,
  "fs.stage_for_telegram": stageForTelegram,
  "browser.tabs.list": listTabs,
  "browser.tabs.inspect": inspectTab,
};

function childDispatchDepth() {
  const raw = Number.parseInt(String(process.env.OPENCLAW_HOST_BRIDGE_ISOLATION_DEPTH || "0"), 10);
  return Number.isInteger(raw) && raw >= 0 ? raw : 0;
}

function shouldIsolateOperation(operation) {
  return CHILD_DISPATCH_OPERATIONS.has(operation) && childDispatchDepth() < 2;
}

async function dispatchInChildProcess(operation, args) {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const payloadPath = path.posix.join("/tmp", `openclaw-host-bridge-dispatch-${nonce}.json`);
  const stdoutPath = path.posix.join("/tmp", `openclaw-host-bridge-dispatch-${nonce}.stdout`);
  const stderrPath = path.posix.join("/tmp", `openclaw-host-bridge-dispatch-${nonce}.stderr`);
  fs.writeFileSync(payloadPath, JSON.stringify({ operation, args: args || {} }), {
    encoding: "utf8",
    mode: 0o600,
  });
  fs.closeSync(fs.openSync(stdoutPath, "w", 0o600));
  fs.closeSync(fs.openSync(stderrPath, "w", 0o600));
  try {
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn("/bin/bash", [CHILD_DISPATCH_SCRIPT, payloadPath], {
        env: { ...process.env },
        stdio: ["ignore", fs.openSync(stdoutPath, "w"), fs.openSync(stderrPath, "w")],
      });
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Child bridge dispatch timed out for ${operation}`));
      }, 120000);
      child.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        resolve(code ?? 0);
      });
    });
    const stdout = fs.readFileSync(stdoutPath, "utf8");
    const stderr = fs.readFileSync(stderrPath, "utf8");
    const parsed = JSON.parse(stdout.trim() || "{}");
    if (exitCode !== 0 || !parsed.ok) {
      const err = new Error(parsed.error?.message || stderr.trim() || `Child bridge dispatch failed for ${operation}`);
      err.code = parsed.error?.code || exitCode || "internal_error";
      throw err;
    }
    return parsed.result;
  } finally {
    fs.rmSync(payloadPath, { force: true });
    fs.rmSync(stdoutPath, { force: true });
    fs.rmSync(stderrPath, { force: true });
  }
}

export async function dispatch(config, operation, args) {
  const handler = HANDLERS[operation];
  if (!handler) {
    const err = new Error(`Unsupported operation: ${operation}`);
    err.code = "unsupported_operation";
    throw err;
  }
  requirePermission(config, operation);
  if (shouldIsolateOperation(operation)) {
    return await dispatchInChildProcess(operation, args);
  }
  return await handler(config, args || {});
}
