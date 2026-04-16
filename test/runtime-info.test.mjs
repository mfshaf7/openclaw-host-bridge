import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { createRuntimeInfo, snapshotRuntimeInfo } from "../src/runtime-info.mjs";

test("runtime info snapshots live attestation data", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-runtime-info-"));
  await fs.writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify({ name: "openclaw-host-bridge", version: "9.9.9" }),
  );

  const previousRoot = process.env.OPENCLAW_HOST_BRIDGE_ROOT;
  const previousOpenClawConfig = process.env.OPENCLAW_CONFIG_PATH;
  const previousEnvFile = process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE;
  process.env.OPENCLAW_HOST_BRIDGE_ROOT = tempRoot;
  process.env.OPENCLAW_CONFIG_PATH = path.join(tempRoot, "openclaw.json");
  process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE = path.join(tempRoot, "openclaw-host-bridge.env");

  try {
    const runtimeInfo = createRuntimeInfo(
      {
        configPath: path.join(tempRoot, "policy.local.json"),
        stagingDir: path.join(tempRoot, "staging"),
        quarantineDir: path.join(tempRoot, "quarantine"),
        auditDir: path.join(tempRoot, "audit"),
      },
      { rootPath: tempRoot, startedAtMs: Date.now() - 5000 },
    );
    const snapshot = snapshotRuntimeInfo(runtimeInfo);

    assert.equal(snapshot.source, "packaged_artifact");
    assert.equal(snapshot.rootPath, tempRoot);
    assert.equal(snapshot.configPath, path.join(tempRoot, "policy.local.json"));
    assert.equal(snapshot.openclawConfigPath, path.join(tempRoot, "openclaw.json"));
    assert.equal(snapshot.envFilePath, path.join(tempRoot, "openclaw-host-bridge.env"));
    assert.equal(snapshot.policyAlignment.expectedOpenClawHome, tempRoot);
    assert.equal(snapshot.policyAlignment.stagingDir, path.join(tempRoot, "staging"));
    assert.equal(snapshot.policyAlignment.quarantineDir, path.join(tempRoot, "quarantine"));
    assert.equal(snapshot.policyAlignment.auditDir, path.join(tempRoot, "audit"));
    assert.equal(snapshot.policyAlignment.ok, true);
    assert.deepEqual(snapshot.policyAlignment.issues, []);
    assert.equal(snapshot.packageVersion, "9.9.9");
    assert.equal(snapshot.pid, process.pid);
    assert.equal(snapshot.nodeVersion, process.version);
    assert.equal(typeof snapshot.startedAt, "string");
    assert.equal(typeof snapshot.uptimeSeconds, "number");
    assert.ok(snapshot.uptimeSeconds >= 5);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.OPENCLAW_HOST_BRIDGE_ROOT;
    } else {
      process.env.OPENCLAW_HOST_BRIDGE_ROOT = previousRoot;
    }
    if (previousOpenClawConfig === undefined) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = previousOpenClawConfig;
    }
    if (previousEnvFile === undefined) {
      delete process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE;
    } else {
      process.env.OPENCLAW_HOST_BRIDGE_ENV_FILE = previousEnvFile;
    }
  }
});

test("runtime info flags policy roots outside the active OpenClaw home", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-runtime-info-"));
  const externalRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-runtime-external-"));

  const previousRoot = process.env.OPENCLAW_HOST_BRIDGE_ROOT;
  const previousOpenClawConfig = process.env.OPENCLAW_CONFIG_PATH;
  process.env.OPENCLAW_HOST_BRIDGE_ROOT = tempRoot;
  process.env.OPENCLAW_CONFIG_PATH = path.join(tempRoot, "openclaw.json");

  try {
    const snapshot = snapshotRuntimeInfo(
      createRuntimeInfo(
        {
          configPath: path.join(tempRoot, "policy.local.json"),
          stagingDir: path.join(externalRoot, "staging"),
          quarantineDir: path.join(externalRoot, "quarantine"),
          auditDir: path.join(externalRoot, "audit"),
        },
        { rootPath: tempRoot, startedAtMs: Date.now() - 1000 },
      ),
    );

    assert.equal(snapshot.policyAlignment.ok, false);
    assert.deepEqual(snapshot.policyAlignment.issues, [
      "staging_dir is outside the active OPENCLAW_CONFIG_PATH home root",
      "audit.dir is outside the active OPENCLAW_CONFIG_PATH home root",
      "quarantine_dir is outside the active OPENCLAW_CONFIG_PATH home root",
    ]);
  } finally {
    if (previousRoot === undefined) {
      delete process.env.OPENCLAW_HOST_BRIDGE_ROOT;
    } else {
      process.env.OPENCLAW_HOST_BRIDGE_ROOT = previousRoot;
    }
    if (previousOpenClawConfig === undefined) {
      delete process.env.OPENCLAW_CONFIG_PATH;
    } else {
      process.env.OPENCLAW_CONFIG_PATH = previousOpenClawConfig;
    }
  }
});
