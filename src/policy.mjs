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

export function isPathWithinRoot(candidate, root) {
  const normalizedCandidate = realNormalized(candidate);
  const normalizedRoot = realNormalized(root);
  return (
    normalizedCandidate === normalizedRoot ||
    normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

export function resolveAllowedPath(config, inputPath, options = {}) {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    const err = new Error("Path must be a non-empty string");
    err.code = "invalid_argument";
    throw err;
  }
  const trimmed = inputPath.trim();
  const direct = path.isAbsolute(trimmed) ? path.resolve(trimmed) : null;
  const candidates = [];
  if (direct) {
    candidates.push(direct);
  } else {
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
