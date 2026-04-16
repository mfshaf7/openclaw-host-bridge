import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addAllowedRoot,
  hostDiscoveryBrowse,
  hostDiscoveryOverview,
  listAllowedRoots,
  removeAllowedRoot,
} from "../src/ops/admin.mjs";
import { inspectTab, listTabs } from "../src/ops/browser.mjs";
import { captureScreenshot, monitorPower } from "../src/ops/display.mjs";
import {
  listDirectory,
  makeDirectory,
  movePath,
  quarantinePath,
  readMetadata,
  searchFiles,
  stageForTelegram,
  zipForExport,
} from "../src/ops/fs.mjs";
import { healthCheck } from "../src/ops/health.mjs";
import { permissionForOperation } from "../src/types.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "..", "contracts", "interface-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const stableHandlers = new Map([
  ["health.check", healthCheck],
  ["config.allowed_roots.list", listAllowedRoots],
  ["config.host_discovery.overview", hostDiscoveryOverview],
  ["config.host_discovery.browse", hostDiscoveryBrowse],
  ["fs.list", listDirectory],
  ["fs.search", searchFiles],
  ["fs.read_meta", readMetadata],
  ["fs.mkdir", makeDirectory],
  ["fs.move", movePath],
  ["fs.quarantine", quarantinePath],
  ["fs.stage_for_telegram", stageForTelegram],
  ["display.screenshot", captureScreenshot],
  ["config.allowed_roots.add", addAllowedRoot],
  ["config.allowed_roots.remove", removeAllowedRoot],
  ["display.monitor_power", monitorPower],
]);

test("interface manifest declares the current stable bridge operations", () => {
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.contractId, "openclaw-host-bridge.interface.v1");
  assert.equal(manifest.ownerRepo, "openclaw-host-bridge");
  assert.deepEqual(manifest.attestation, {
    healthEndpoint: "/healthz",
    statusScript: "scripts/status-openclaw-host-stack.sh",
  });

  const declared = manifest.stableOperations.map((entry) => entry.name);
  assert.deepEqual(declared, [...stableHandlers.keys()]);

  for (const entry of manifest.stableOperations) {
    assert.equal(
      typeof stableHandlers.get(entry.name),
      "function",
      `expected ${entry.name} to resolve to a stable bridge handler`,
    );
    assert.equal(
      permissionForOperation(entry.name),
      entry.permission,
      `permission drift for ${entry.name}`,
    );
  }
});

test("interface manifest declares the current scaffold-only bridge operations", async () => {
  assert.deepEqual(
    manifest.scaffoldOperations.map((entry) => entry.name),
    ["browser.tabs.list", "browser.tabs.inspect", "fs.zip_for_export"],
  );

  for (const entry of manifest.scaffoldOperations) {
    assert.equal(
      permissionForOperation(entry.name),
      entry.permission,
      `permission drift for scaffold operation ${entry.name}`,
    );
  }

  const listResult = await listTabs();
  assert.equal(listResult.available, false);
  assert.match(listResult.message, /not implemented yet in the scaffold/i);

  await assert.rejects(
    () => inspectTab(),
    (error) => {
      assert.equal(error?.code, "not_implemented");
      assert.match(String(error?.message ?? ""), /not implemented yet in the scaffold/i);
      return true;
    },
  );

  await assert.rejects(
    () => zipForExport(),
    (error) => {
      assert.equal(error?.code, "not_implemented");
      assert.match(String(error?.message ?? ""), /not implemented yet in the scaffold/i);
      return true;
    },
  );
});
