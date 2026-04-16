import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function readPackageVersion(rootPath) {
  try {
    const packagePath = path.join(rootPath, "package.json");
    const raw = JSON.parse(fs.readFileSync(packagePath, "utf8"));
    return typeof raw.version === "string" ? raw.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function readGitCommit(rootPath) {
  try {
    return execFileSync("git", ["-C", rootPath, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function inferRuntimeSource(rootPath) {
  return rootPath.includes(`${path.sep}projects${path.sep}`) ? "repo_checkout" : "packaged_artifact";
}

function inferExpectedOpenClawHome(openclawConfigPath) {
  return path.dirname(openclawConfigPath);
}

function isWithinRoot(targetPath, rootPath) {
  const normalizedTarget = path.resolve(targetPath);
  const normalizedRoot = path.resolve(rootPath);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`);
}

function summarizePolicyAlignment(config, openclawConfigPath) {
  const expectedOpenClawHome = inferExpectedOpenClawHome(openclawConfigPath);
  const stagingDir = path.resolve(config.stagingDir);
  const auditDir = path.resolve(config.auditDir);
  const quarantineDir = path.resolve(config.quarantineDir);
  const issues = [];

  if (!isWithinRoot(stagingDir, expectedOpenClawHome)) {
    issues.push("staging_dir is outside the active OPENCLAW_CONFIG_PATH home root");
  }
  if (!isWithinRoot(auditDir, expectedOpenClawHome)) {
    issues.push("audit.dir is outside the active OPENCLAW_CONFIG_PATH home root");
  }
  if (!isWithinRoot(quarantineDir, expectedOpenClawHome)) {
    issues.push("quarantine_dir is outside the active OPENCLAW_CONFIG_PATH home root");
  }

  return {
    expectedOpenClawHome,
    stagingDir,
    auditDir,
    quarantineDir,
    ok: issues.length === 0,
    issues,
  };
}

export function createRuntimeInfo(config, options = {}) {
  const startedAtMs = options.startedAtMs ?? Date.now();
  const rootPath = path.resolve(options.rootPath ?? process.env.OPENCLAW_HOST_BRIDGE_ROOT ?? process.cwd());
  const configPath = path.resolve(options.configPath ?? config.configPath);
  const openclawConfigPath = process.env.OPENCLAW_CONFIG_PATH
    ? path.resolve(process.env.OPENCLAW_CONFIG_PATH)
    : path.join(os.homedir(), ".openclaw", "openclaw.json");
  const envFilePath = process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE
    ? path.resolve(process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE)
    : null;

  return {
    source: inferRuntimeSource(rootPath),
    pid: process.pid,
    startedAt: new Date(startedAtMs).toISOString(),
    uptimeSeconds: () => Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
    nodeVersion: process.version,
    rootPath,
    configPath,
    openclawConfigPath,
    envFilePath,
    policyAlignment: summarizePolicyAlignment(config, openclawConfigPath),
    packageVersion: readPackageVersion(rootPath),
    gitCommit: readGitCommit(rootPath),
  };
}

export function snapshotRuntimeInfo(runtimeInfo) {
  return {
    source: runtimeInfo.source,
    pid: runtimeInfo.pid,
    startedAt: runtimeInfo.startedAt,
    uptimeSeconds: runtimeInfo.uptimeSeconds(),
    nodeVersion: runtimeInfo.nodeVersion,
    rootPath: runtimeInfo.rootPath,
    configPath: runtimeInfo.configPath,
    openclawConfigPath: runtimeInfo.openclawConfigPath,
    envFilePath: runtimeInfo.envFilePath,
    policyAlignment: runtimeInfo.policyAlignment,
    packageVersion: runtimeInfo.packageVersion,
    gitCommit: runtimeInfo.gitCommit,
  };
}
