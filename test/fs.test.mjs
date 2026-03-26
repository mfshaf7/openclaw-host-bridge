import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { searchFiles, stageForTelegram } from "../src/ops/fs.mjs";

test("searchFiles can return matching directories", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pc-control-bridge-"));
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pc-control-bridge-"));
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
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "pc-control-bridge-"));
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
