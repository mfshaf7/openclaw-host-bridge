import fs from "node:fs/promises";
import path from "node:path";
import { normalizeInputPath } from "../policy.mjs";

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

function normalizeRootForStorage(root) {
  if (typeof root !== "string" || !root.trim()) {
    const err = new Error("root must be a non-empty string");
    err.code = "invalid_argument";
    throw err;
  }
  const normalized = normalizeInputPath(root.trim());
  return path.resolve(normalized);
}

async function loadRawConfig(config) {
  const raw = JSON.parse(await fs.readFile(config.configPath, "utf8"));
  if (!Array.isArray(raw.allowed_roots)) {
    raw.allowed_roots = [];
  }
  return raw;
}

async function writeRawConfig(config, raw) {
  await fs.writeFile(config.configPath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

function inferWindowsHome(config) {
  for (const root of config.allowedRoots) {
    const match = /^(\/mnt\/[a-z]\/Users\/[^/]+)/i.exec(root);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

async function listDirectoryEntries(targetPath, limit = 40) {
  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  return entries.slice(0, limit).map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other",
  }));
}

export async function listAllowedRoots(config) {
  return {
    roots: config.allowedRoots,
  };
}

export async function addAllowedRoot(config, args) {
  const root = normalizeRootForStorage(args?.root);
  const raw = await loadRawConfig(config);
  const existing = new Set(
    raw.allowed_roots
      .filter((entry) => typeof entry === "string" && entry.trim())
      .map((entry) => path.resolve(normalizeInputPath(entry.trim()))),
  );
  existing.add(root);
  raw.allowed_roots = Array.from(existing);
  await writeRawConfig(config, raw);
  return {
    root,
    roots: raw.allowed_roots,
    added: true,
  };
}

export async function removeAllowedRoot(config, args) {
  const root = normalizeRootForStorage(args?.root);
  const raw = await loadRawConfig(config);
  raw.allowed_roots = raw.allowed_roots.filter((entry) => {
    if (typeof entry !== "string" || !entry.trim()) {
      return false;
    }
    return path.resolve(normalizeInputPath(entry.trim())) !== root;
  });
  await writeRawConfig(config, raw);
  return {
    root,
    roots: raw.allowed_roots,
    removed: true,
  };
}

export async function hostDiscoveryOverview(config) {
  const homePath = inferWindowsHome(config);
  const drives = await fs
    .readdir("/mnt", { withFileTypes: true })
    .then((entries) =>
      entries
        .filter((entry) => entry.isDirectory() && /^[a-z]$/i.test(entry.name))
        .map((entry) => {
          const wslPath = `/mnt/${entry.name.toLowerCase()}`;
          return {
            name: `${entry.name.toUpperCase()}:`,
            path: wslPath,
            windowsPath: toWindowsPath(wslPath),
          };
        }),
    )
    .catch(() => []);
  const homeEntries = homePath ? await listDirectoryEntries(homePath, 30).catch(() => []) : [];
  return {
    home: homePath
      ? {
          path: homePath,
          windowsPath: toWindowsPath(homePath),
        }
      : null,
    drives,
    homeEntries,
  };
}

export async function hostDiscoveryBrowse(_config, args) {
  const rawPath = typeof args?.path === "string" ? args.path.trim() : "";
  if (!rawPath) {
    const err = new Error("path must be a non-empty string");
    err.code = "invalid_argument";
    throw err;
  }
  const targetPath = path.resolve(normalizeInputPath(rawPath));
  if (!/^\/mnt\/[a-z](?:\/|$)/i.test(targetPath)) {
    const err = new Error("host discovery browse only supports /mnt/<drive> paths");
    err.code = "policy_denied";
    throw err;
  }
  return {
    path: {
      path: targetPath,
      windowsPath: toWindowsPath(targetPath),
    },
    entries: await listDirectoryEntries(targetPath, 40),
  };
}
