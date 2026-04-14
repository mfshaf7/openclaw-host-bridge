import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { healthCheck } from "../src/ops/health.mjs";

test("healthCheck returns structured components payload", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-health-"));
  const allowedRoot = path.join(tempRoot, "allowed");
  const stagingDir = path.join(tempRoot, "staging");
  const auditDir = path.join(tempRoot, "audit");
  await fs.mkdir(allowedRoot, { recursive: true });
  await fs.mkdir(stagingDir, { recursive: true });
  await fs.mkdir(auditDir, { recursive: true });

  const result = await healthCheck({
    configPath: path.join(tempRoot, "policy.local.json"),
    listenHost: "127.0.0.1",
    listenPort: 48721,
    mode: "default_read_only",
    allowedRoots: [allowedRoot],
    stagingDir,
    auditDir,
  });

  assert.equal(typeof result.ok, "boolean");
  assert.ok(result.components);
  assert.ok(result.components.panel);
  assert.ok(result.components.bridge);
  assert.ok(result.components.host);
  assert.ok(result.components.storage);
  assert.ok(result.components.integrations);
  assert.equal(result.components.bridge.service, "openclaw-host-bridge");
  assert.equal(result.components.storage.allowedRoots[0].path, allowedRoot);
  assert.equal(result.components.storage.allowedRoots[0].exists, true);
});


test("healthCheck uses configured windows snapshot in WSL mode", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-host-health-snapshot-"));
  const allowedRoot = path.join(tempRoot, "allowed");
  const stagingDir = path.join(tempRoot, "staging");
  const auditDir = path.join(tempRoot, "audit");
  const snapshotPath = path.join(tempRoot, "windows-health.json");
  await fs.mkdir(allowedRoot, { recursive: true });
  await fs.mkdir(stagingDir, { recursive: true });
  await fs.mkdir(auditDir, { recursive: true });
  await fs.writeFile(
    snapshotPath,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      panel: {
        cpu: { model: "Snapshot CPU", clockMhz: 4321 },
        gpu: { name: "Snapshot GPU", utilizationPercent: 7, temperatureC: 42, vramUsedBytes: 123, vramTotalBytes: 456, clockMhz: 789 },
        ram: { clockMhz: 3600 },
        display: { width: 2560, height: 1440, refreshHz: 144 },
        publicIp: { ok: true, address: "203.0.113.10", provider: "test" },
      },
      ollama: { ok: true, status: 200, body: { models: [] } },
    }),
  );

  const previousSnapshot = process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT;
  const previousDistro = process.env.WSL_DISTRO_NAME;
  process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT = snapshotPath;
  process.env.WSL_DISTRO_NAME = "TestWSL";

  try {
    const result = await healthCheck({
      configPath: path.join(tempRoot, "policy.local.json"),
      listenHost: "127.0.0.1",
      listenPort: 48721,
      mode: "default_read_only",
      allowedRoots: [allowedRoot],
      stagingDir,
      auditDir,
    });

    assert.equal(result.components.panel.cpu.model, "Snapshot CPU");
    assert.equal(result.components.panel.cpu.clockMhz, 4321);
    assert.equal(result.components.panel.gpu.name, "Snapshot GPU");
    assert.equal(result.components.integrations.ollama.ok, true);
    assert.equal(result.components.diagnostics.windowsSnapshot.ok, true);
  } finally {
    if (previousSnapshot === undefined) {
      delete process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT;
    } else {
      process.env.OPENCLAW_WINDOWS_HEALTH_SNAPSHOT = previousSnapshot;
    }
    if (previousDistro === undefined) {
      delete process.env.WSL_DISTRO_NAME;
    } else {
      process.env.WSL_DISTRO_NAME = previousDistro;
    }
  }
});
