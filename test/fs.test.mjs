import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { quarantinePath, searchFiles, stageForTelegram } from "../src/ops/fs.mjs";

test("searchFiles can return matching directories", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-"));
  const allowedRoot = path.join(root, "Music");
  const targetDir = path.join(allowedRoot, "Spotify-Local");
  await fs.mkdir(targetDir, { recursive: true });

  const result = await searchFiles(
    {
      allowedRoots: [allowedRoot],
      limits: { searchMaxResults: 20 },
    },
    {
      root: allowedRoot,
      pattern: "*spotify-local*",
      includeFiles: false,
      includeDirectories: true,
    },
  );

  assert.equal(result.root, allowedRoot);
  assert.equal(result.pattern, "*spotify-local*");
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].path, targetDir);
  assert.equal(result.results[0].type, "directory");
});

test("stageForTelegram copies an allowed file into the staging directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-"));
  const allowedRoot = path.join(root, "Downloads");
  const stagingDir = path.join(root, "Staging");
  await fs.mkdir(allowedRoot, { recursive: true });
  const sourcePath = path.join(allowedRoot, "resume.pdf");
  await fs.writeFile(sourcePath, "resume-bytes", "utf8");

  const result = await stageForTelegram(
    {
      allowedRoots: [allowedRoot],
      stagingDir,
      limits: { maxExportBytes: 1024 * 1024 },
    },
    { path: sourcePath },
  );

  assert.equal(result.original_path, sourcePath);
  assert.equal(result.staged, true);
  assert.match(result.path, new RegExp(`^${stagingDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(await fs.readFile(result.path, "utf8"), "resume-bytes");
});

test("stageForTelegram rejects directories", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-"));
  const allowedRoot = path.join(root, "Downloads");
  const stagingDir = path.join(root, "Staging");
  await fs.mkdir(path.join(allowedRoot, "folder"), { recursive: true });

  await assert.rejects(
    () =>
      stageForTelegram(
        {
          allowedRoots: [allowedRoot],
          stagingDir,
          limits: { maxExportBytes: 1024 * 1024 },
        },
        { path: path.join(allowedRoot, "folder") },
      ),
    /regular files/,
  );
});

test("quarantinePath moves an allowed path into the quarantine directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-"));
  const allowedRoot = path.join(root, "Downloads");
  const quarantineDir = path.join(root, "Quarantine");
  await fs.mkdir(allowedRoot, { recursive: true });
  const sourcePath = path.join(allowedRoot, "old-folder");
  await fs.mkdir(sourcePath, { recursive: true });

  const result = await quarantinePath(
    {
      allowedRoots: [allowedRoot],
      quarantineDir,
    },
    { path: sourcePath },
  );

  assert.equal(result.source, sourcePath);
  assert.equal(result.quarantined, true);
  assert.match(result.destination, new RegExp(`^${quarantineDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  await assert.rejects(() => fs.stat(sourcePath), /ENOENT/);
  const stat = await fs.stat(result.destination);
  assert.equal(stat.isDirectory(), true);
});

test("quarantinePath can cross filesystems by copy-and-remove fallback", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-"));
  const allowedRoot = path.join(root, "Downloads");
  const quarantineDir = path.join(os.tmpdir(), `openclaw-host-quarantine-${Date.now()}`);
  await fs.mkdir(allowedRoot, { recursive: true });
  const sourcePath = path.join(allowedRoot, "note.txt");
  await fs.writeFile(sourcePath, "hello", "utf8");

  const result = await quarantinePath(
    {
      allowedRoots: [allowedRoot],
      quarantineDir,
    },
    { path: sourcePath },
  );

  assert.equal(await fs.readFile(result.destination, "utf8"), "hello");
  await assert.rejects(() => fs.stat(sourcePath), /ENOENT/);
});
