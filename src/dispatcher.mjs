import { requirePermission } from "./policy.mjs";
import { healthCheck } from "./ops/health.mjs";
import {
  addAllowedRoot,
  hostDiscoveryBrowse,
  hostDiscoveryOverview,
  listAllowedRoots,
  removeAllowedRoot,
} from "./ops/admin.mjs";
import { captureScreenshot, monitorPower } from "./ops/display.mjs";
import {
  listDirectory,
  makeDirectory,
  movePath,
  quarantinePath,
  readMetadata,
  searchFiles,
  stageForTelegram,
  zipForExport,
} from "./ops/fs.mjs";
import { inspectTab, listTabs } from "./ops/browser.mjs";

const HANDLERS = {
  "health.check": healthCheck,
  "config.allowed_roots.list": listAllowedRoots,
  "config.allowed_roots.add": addAllowedRoot,
  "config.allowed_roots.remove": removeAllowedRoot,
  "config.host_discovery.overview": hostDiscoveryOverview,
  "config.host_discovery.browse": hostDiscoveryBrowse,
  "display.monitor_power": monitorPower,
  "display.screenshot": captureScreenshot,
  "fs.list": listDirectory,
  "fs.search": searchFiles,
  "fs.read_meta": readMetadata,
  "fs.mkdir": makeDirectory,
  "fs.move": movePath,
  "fs.quarantine": quarantinePath,
  "fs.zip_for_export": zipForExport,
  "fs.stage_for_telegram": stageForTelegram,
  "browser.tabs.list": listTabs,
  "browser.tabs.inspect": inspectTab,
};

export async function dispatch(config, operation, args) {
  const handler = HANDLERS[operation];
  if (!handler) {
    const err = new Error(`Unsupported operation: ${operation}`);
    err.code = "unsupported_operation";
    throw err;
  }
  requirePermission(config, operation);
  return await handler(config, args || {});
}
