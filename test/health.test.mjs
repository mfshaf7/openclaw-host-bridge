import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";

import { healthCheck } from "../src/ops/health.mjs";

test("healthCheck returns structured components payload", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pc-control-health-"));
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
  assert.equal(result.components.bridge.service, "pc-control-bridge");
  assert.equal(result.components.storage.allowedRoots[0].path, allowedRoot);
  assert.equal(result.components.storage.allowedRoots[0].exists, true);
});
