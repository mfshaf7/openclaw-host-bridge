import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { captureScreenshot } from "../src/ops/display.mjs";

const tmpRoot = async () => await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-bridge-display-"));

test("captureScreenshot returns only screenshot files that were actually written", async () => {
  const root = await tmpRoot();
  const finalFirstPath = path.join(root, "display-1.png");
  const finalSecondPath = path.join(root, "display-2.png");
  const captureFirstPath = path.join(root, "capture-1.png");
  const captureSecondPath = path.join(root, "capture-2.png");

  const result = await captureScreenshot(
    { stagingDir: root },
    { file_name: "desktop.png" },
    {
      runPowerShell: async (script) => {
        if (script.includes("AllScreens.Count")) {
          return "2";
        }
        await fs.writeFile(captureFirstPath, "one", "utf8");
        return "[0,1]";
      },
      allocateScreenshotPath: async () => finalFirstPath,
      allocateScreenshotPaths: async () => [finalFirstPath, finalSecondPath],
      allocateCapturePaths: async () => [captureFirstPath, captureSecondPath],
      stat: async (entry) => await fs.stat(entry),
      copyFile: async (source, destination) => await fs.copyFile(source, destination),
      removeFile: async (entry) => await fs.rm(entry, { force: true }),
    },
  );

  assert.equal(result.path, finalFirstPath);
  assert.deepEqual(result.paths, [finalFirstPath]);
  assert.deepEqual(result.displays, [{ path: finalFirstPath, primary: true }]);
  assert.equal(result.size, 3);
  await assert.rejects(() => fs.stat(captureFirstPath), /ENOENT/);
});

test("captureScreenshot falls back to probing capture paths when powershell output is empty", async () => {
  const root = await tmpRoot();
  const finalFirstPath = path.join(root, "display-1.png");
  const captureFirstPath = path.join(root, "capture-1.png");

  const result = await captureScreenshot(
    { stagingDir: root },
    { file_name: "desktop.png" },
    {
      runPowerShell: async (script) => {
        if (script.includes("AllScreens.Count")) {
          return "1";
        }
        await fs.writeFile(captureFirstPath, "fallback", "utf8");
        return "";
      },
      allocateScreenshotPath: async () => finalFirstPath,
      allocateScreenshotPaths: async () => [finalFirstPath],
      allocateCapturePaths: async () => [captureFirstPath],
      stat: async (entry) => await fs.stat(entry),
      copyFile: async (source, destination) => await fs.copyFile(source, destination),
      removeFile: async (entry) => await fs.rm(entry, { force: true }),
    },
  );

  assert.equal(result.path, finalFirstPath);
  assert.deepEqual(result.paths, [finalFirstPath]);
  assert.equal(result.size, 8);
});

test("captureScreenshot fails when no readable screenshot files were produced", async () => {
  const root = await tmpRoot();
  const finalFirstPath = path.join(root, "display-1.png");
  const captureFirstPath = path.join(root, "capture-1.png");

  await assert.rejects(
    () =>
      captureScreenshot(
        { stagingDir: root },
        { file_name: "desktop.png" },
        {
          runPowerShell: async (script) => (script.includes("AllScreens.Count") ? "1" : "[0]"),
          allocateScreenshotPath: async () => finalFirstPath,
          allocateScreenshotPaths: async () => [finalFirstPath],
          allocateCapturePaths: async () => [captureFirstPath],
          stat: async (entry) => await fs.stat(entry),
        },
      ),
    /no readable files/i,
  );
});
