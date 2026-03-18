import fs from "node:fs/promises";
import path from "node:path";
import { resolveAllowedPath } from "../policy.mjs";

function summarizeDirent(basePath, entry) {
  return {
    name: entry.name,
    path: path.join(basePath, entry.name),
    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
  };
}

export async function listDirectory(config, args) {
  const targetPath = resolveAllowedPath(config, args?.path || ".");
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return {
    path: targetPath,
    entries: entries.map((entry) => summarizeDirent(targetPath, entry)),
  };
}

async function walk(rootPath, pattern, results, limit) {
  if (results.length >= limit) {
    return;
  }
  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (results.length >= limit) {
      return;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, pattern, results, limit);
      continue;
    }
    if (pattern.test(entry.name)) {
      const stat = await fs.stat(fullPath);
      results.push({
        path: fullPath,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  }
}

function globToRegExp(glob) {
  const escaped = String(glob || "*")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

export async function searchFiles(config, args) {
  const root = resolveAllowedPath(config, args?.root || ".");
  const pattern = globToRegExp(args?.pattern || "*");
  const limit = Math.min(Number(args?.limit || config.limits.searchMaxResults), config.limits.searchMaxResults);
  const results = [];
  await walk(root, pattern, results, limit);
  return { root, pattern: String(args?.pattern || "*"), results };
}

export async function readMetadata(config, args) {
  const targetPath = resolveAllowedPath(config, args?.path);
  const stat = await fs.stat(targetPath);
  return {
    path: targetPath,
    type: stat.isDirectory() ? "directory" : stat.isFile() ? "file" : "other",
    size: stat.size,
    createdAt: stat.birthtime.toISOString(),
    modifiedAt: stat.mtime.toISOString(),
    accessedAt: stat.atime.toISOString(),
  };
}

export async function makeDirectory(config, args) {
  const targetPath = resolveAllowedPath(config, args?.path);
  await fs.mkdir(targetPath, { recursive: true });
  return { path: targetPath, created: true };
}

export async function movePath(config, args) {
  const source = resolveAllowedPath(config, args?.source);
  const destination = resolveAllowedPath(config, args?.destination);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);
  return { source, destination, moved: true };
}

export async function zipForExport() {
  const err = new Error("zip_for_export is not implemented yet in the scaffold");
  err.code = "not_implemented";
  throw err;
}

function splitName(fileName) {
  const parsed = path.parse(fileName);
  return {
    base: parsed.name || "export",
    ext: parsed.ext || "",
  };
}

async function allocateStagingPath(config, fileName) {
  const { base, ext } = splitName(fileName);
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  const stagedFileName = `${base}-${timestamp}-${suffix}${ext}`;
  const stagedPath = path.join(config.stagingDir, stagedFileName);
  await fs.mkdir(config.stagingDir, { recursive: true });
  return stagedPath;
}

export async function stageForTelegram(config, args) {
  const sourcePath = resolveAllowedPath(config, args?.path);
  const stat = await fs.stat(sourcePath);
  if (!stat.isFile()) {
    const err = new Error("stage_for_telegram only supports regular files");
    err.code = "invalid_argument";
    throw err;
  }
  if (stat.size > config.limits.maxExportBytes) {
    const err = new Error("File exceeds max_export_bytes policy limit");
    err.code = "policy_denied";
    throw err;
  }
  const stagedPath = await allocateStagingPath(config, path.basename(sourcePath));
  await fs.copyFile(sourcePath, stagedPath);
  return {
    original_path: sourcePath,
    path: stagedPath,
    file_name: path.basename(stagedPath),
    size: stat.size,
    staged: true,
  };
}
