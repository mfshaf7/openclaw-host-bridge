import fs from "node:fs/promises";
import path from "node:path";
import { permissionForOperation } from "./types.mjs";

export async function ensureDirectories(config) {
  await fs.mkdir(config.auditDir, { recursive: true });
  await fs.mkdir(config.stagingDir, { recursive: true });
}

export function requirePermission(config, operation) {
  const permission = permissionForOperation(operation);
  if (config.permissions[permission] !== true) {
    const err = new Error(`Operation ${operation} denied by permission ${permission}`);
    err.code = "policy_denied";
    throw err;
  }
}

function realNormalized(candidate) {
  return path.resolve(candidate);
}

function normalizeAliasKey(value) {
  return value.trim().replace(/[\\/]+/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
}

export function normalizeInputPath(inputPath) {
  const trimmed = inputPath.trim();
  const driveMatch = /^([a-zA-Z]):[\\/](.*)$/.exec(trimmed);
  if (!driveMatch) {
    return trimmed;
  }
  const drive = driveMatch[1].toLowerCase();
  const remainder = driveMatch[2].replace(/[\\]+/g, "/");
  return `/mnt/${drive}/${remainder}`;
}

export function isPathWithinRoot(candidate, root) {
  const normalizedCandidate = realNormalized(candidate);
  const normalizedRoot = realNormalized(root);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

function buildAllowedRootAliasMap(config) {
  const aliases = new Map();
  for (const root of config.allowedRoots) {
    const baseName = path.basename(root).trim();
    if (!baseName) {
      continue;
    }
    aliases.set(baseName.toLowerCase(), root);
  }
  return aliases;
}

function resolveAliasCandidate(config, inputPath) {
  const normalized = normalizeAliasKey(inputPath);
  if (!normalized) {
    return null;
  }
  const aliases = buildAllowedRootAliasMap(config);
  const segments = normalized.split("/");
  const rootAlias = segments[0];
  const mappedRoot = aliases.get(rootAlias);
  if (!mappedRoot) {
    return null;
  }
  const remainder = segments.slice(1).join(path.sep);
  return remainder ? path.resolve(mappedRoot, remainder) : path.resolve(mappedRoot);
}

export function resolveAllowedPath(config, inputPath, options = {}) {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    const err = new Error("Path must be a non-empty string");
    err.code = "invalid_argument";
    throw err;
  }
  const trimmed = normalizeInputPath(inputPath);
  const direct = path.isAbsolute(trimmed) ? path.resolve(trimmed) : null;
  const candidates = [];
  if (direct) {
    candidates.push(direct);
  } else {
    const aliasCandidate = resolveAliasCandidate(config, trimmed);
    if (aliasCandidate) {
      candidates.push(aliasCandidate);
    }
    for (const root of config.allowedRoots) {
      candidates.push(path.resolve(root, trimmed));
    }
  }
  if (options.includeStaging === true) {
    candidates.push(path.resolve(config.stagingDir, trimmed));
  }
  for (const candidate of candidates) {
    if (
      config.allowedRoots.some((root) => isPathWithinRoot(candidate, root)) ||
      (options.includeStaging === true && isPathWithinRoot(candidate, config.stagingDir))
    ) {
      return candidate;
    }
  }
  const err = new Error("Path is outside allowed roots");
  err.code = "policy_denied";
  throw err;
}
