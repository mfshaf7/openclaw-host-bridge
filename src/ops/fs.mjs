import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { resolveAllowedPath } from "../policy.mjs";

const execFile = promisify(execFileCallback);
const PROTECTED_WINDOWS_NAMES = new Set([
  "system volume information",
  "$recycle.bin",
  "recovery",
  "config.msi",
]);

function summarizeDirent(basePath, entry) {
  return {
    name: entry.name,
    path: path.join(basePath, entry.name),
    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
  };
}

function globToRegExp(glob) {
  const escaped = String(glob || "*")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function isProtectedWindowsPath(candidatePath) {
  const parts = candidatePath.split(/[\\/]+/).filter(Boolean);
  return parts.some((part) => PROTECTED_WINDOWS_NAMES.has(part.toLowerCase()));
}

function toWindowsPath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  const normalized = value.trim();
  const match = /^\/mnt\/([a-z])(?:\/(.*))?$/i.exec(normalized);
  if (!match) {
    return normalized;
  }
  const drive = match[1].toUpperCase();
  const tail = (match[2] || "").replace(/\//g, "\\");
  return tail ? `${drive}:\\${tail}` : `${drive}:\\`;
}

function canUseWindowsFallback(source, destination, error) {
  return (
    (error?.code === "EACCES" || error?.code === "EPERM") &&
    /^\/mnt\/[a-z](?:\/|$)/i.test(source) &&
    /^\/mnt\/[a-z](?:\/|$)/i.test(destination)
  );
}

async function runWindowsMoveFallback(source, destination) {
  const sourceWindows = toWindowsPath(source);
  const destinationWindows = toWindowsPath(destination);
  const sourceDir = path.posix.dirname(source);
  const destinationDir = path.posix.dirname(destination);
  const sourceName = path.posix.basename(source);
  const destinationName = path.posix.basename(destination);
  const sameDirectory = sourceDir === destinationDir;
  const script = sameDirectory
    ? [
        "$ErrorActionPreference = 'Stop'",
        `Rename-Item -LiteralPath '${sourceWindows.replace(/'/g, "''")}' -NewName '${destinationName.replace(/'/g, "''")}'`,
      ].join("; ")
    : [
        "$ErrorActionPreference = 'Stop'",
        `Move-Item -LiteralPath '${sourceWindows.replace(/'/g, "''")}' -Destination '${destinationWindows.replace(/'/g, "''")}'`,
      ].join("; ");
  await execFile(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { timeout: 5000, maxBuffer: 512 * 1024 },
  );
}

async function walk(rootPath, pattern, results, limit, options) {
  if (results.length >= limit || isProtectedWindowsPath(rootPath)) {
    return;
  }
  let entries;
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "EACCES" || error?.code === "EPERM") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    if (results.length >= limit) {
      return;
    }
    const fullPath = path.join(rootPath, entry.name);
    if (isProtectedWindowsPath(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (options.includeDirectories && pattern.test(entry.name)) {
        const stat = await fs.stat(fullPath).catch(() => null);
        results.push({
          path: fullPath,
          type: "directory",
          modifiedAt: stat ? stat.mtime.toISOString() : null,
        });
        if (results.length >= limit) {
          return;
        }
      }
      await walk(fullPath, pattern, results, limit, options);
      continue;
    }

    if (!entry.isFile() || !options.includeFiles || !pattern.test(entry.name)) {
      continue;
    }
    const stat = await fs.stat(fullPath);
    results.push({
      path: fullPath,
      type: "file",
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }
}

export async function listDirectory(config, args) {
  const targetPath = resolveAllowedPath(config, args?.path || ".");
  if (isProtectedWindowsPath(targetPath)) {
    const err = new Error("Path is protected and cannot be listed");
    err.code = "policy_denied";
    throw err;
  }
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return {
    path: targetPath,
    entries: entries.map((entry) => summarizeDirent(targetPath, entry)),
  };
}

export async function searchFiles(config, args) {
  const root = resolveAllowedPath(config, args?.root || ".");
  if (isProtectedWindowsPath(root)) {
    const err = new Error("Path is protected and cannot be searched");
    err.code = "policy_denied";
    throw err;
  }
  const pattern = globToRegExp(args?.pattern || "*");
  const limit = Math.min(Number(args?.limit || config.limits.searchMaxResults), config.limits.searchMaxResults);
  const includeFiles = args?.includeFiles !== false;
  const includeDirectories = args?.includeDirectories === true;
  const results = [];
  await walk(root, pattern, results, limit, {
    includeFiles,
    includeDirectories,
  });
  return { root, pattern: String(args?.pattern || "*"), results };
}

export async function readMetadata(config, args) {
  const targetPath = resolveAllowedPath(config, args?.path);
  if (isProtectedWindowsPath(targetPath)) {
    const err = new Error("Path is protected and cannot be inspected");
    err.code = "policy_denied";
    throw err;
  }
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
  if (isProtectedWindowsPath(targetPath)) {
    const err = new Error("Path is protected and cannot be created");
    err.code = "policy_denied";
    throw err;
  }
  await fs.mkdir(targetPath, { recursive: true });
  return { path: targetPath, created: true };
}

export async function movePath(config, args) {
  const source = resolveAllowedPath(config, args?.source);
  const destination = resolveAllowedPath(config, args?.destination);
  if (isProtectedWindowsPath(source) || isProtectedWindowsPath(destination)) {
    const err = new Error("Protected filesystem paths cannot be moved");
    err.code = "policy_denied";
    throw err;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.rename(source, destination);
  } catch (error) {
    if (!canUseWindowsFallback(source, destination, error)) {
      throw error;
    }
    await runWindowsMoveFallback(source, destination);
  }
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
  if (isProtectedWindowsPath(sourcePath)) {
    const err = new Error("Protected filesystem paths cannot be exported");
    err.code = "policy_denied";
    throw err;
  }
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
