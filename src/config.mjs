import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function expandEnv(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/%([^%]+)%/g, (_, name) => process.env[name] ?? `%${name}%`);
}

function normalizeUserPath(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/[\\/]+/g, path.sep);
}

function homeDir() {
  return process.env.USERPROFILE || os.homedir();
}

function resolveAllowedRoot(root) {
  if (typeof root !== "string" || !root.trim()) {
    throw new Error("allowed_roots entries must be non-empty strings");
  }
  const expanded = normalizeUserPath(expandEnv(root.trim()));
  if (path.isAbsolute(expanded)) {
    return path.resolve(expanded);
  }
  return path.resolve(homeDir(), expanded);
}

export async function loadConfig() {
  const configPath = process.env.OPENCLAW_HOST_BRIDGE_CONFIG
    ? path.resolve(process.env.OPENCLAW_HOST_BRIDGE_CONFIG)
    : path.resolve(process.cwd(), "config", "policy.json");
  const raw = JSON.parse(await fs.readFile(configPath, "utf8"));
  const tokenEnv = raw?.auth?.token_env || "OPENCLAW_HOST_BRIDGE_TOKEN";
  const authToken = process.env[tokenEnv];
  if (!authToken) {
    throw new Error(`Missing auth token env: ${tokenEnv}`);
  }
  const listenHost = raw?.listen?.host || "127.0.0.1";
  const listenPort = Number(raw?.listen?.port || 48721);
  const allowedRoots = Array.isArray(raw?.allowed_roots)
    ? raw.allowed_roots.map(resolveAllowedRoot)
    : [];
  if (allowedRoots.length === 0) {
    throw new Error("Config must define at least one allowed root");
  }
  const stagingDir = resolveAllowedRoot(raw?.staging_dir || "Downloads\\OpenClaw-Staging");
  const quarantineDir = raw?.quarantine_dir
    ? resolveAllowedRoot(raw.quarantine_dir)
    : path.join(path.dirname(stagingDir), "openclaw-host-quarantine");
  const auditDir = path.resolve(
    normalizeUserPath(
      expandEnv(raw?.audit?.dir || "%LOCALAPPDATA%\\OpenClaw\\openclaw-host-bridge\\audit"),
    ),
  );
  const limits = {
    searchMaxResults: Number(raw?.limits?.search_max_results || 100),
    maxExportFiles: Number(raw?.limits?.max_export_files || 20),
    maxExportBytes: Number(raw?.limits?.max_export_bytes || 100 * 1024 * 1024),
  };
  return {
    configPath,
    listenHost,
    listenPort,
    authToken,
    allowedRoots,
    stagingDir,
    quarantineDir,
    auditDir,
    permissions: {
      read: raw?.permissions?.read === true,
      organize: raw?.permissions?.organize === true,
      export: raw?.permissions?.export === true,
      browser_inspect: raw?.permissions?.browser_inspect === true,
      admin_high_risk: raw?.permissions?.admin_high_risk === true,
    },
    limits,
    mode: raw?.mode || "default_read_only",
  };
}
