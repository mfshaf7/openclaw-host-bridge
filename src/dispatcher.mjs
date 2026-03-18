import { requirePermission } from "./policy.mjs";
import { healthCheck } from "./ops/health.mjs";
import {
  listDirectory,
  makeDirectory,
  movePath,
  readMetadata,
  searchFiles,
  stageForTelegram,
  zipForExport,
} from "./ops/fs.mjs";
import { inspectTab, listTabs } from "./ops/browser.mjs";

const HANDLERS = {
  "health.check": healthCheck,
  "fs.list": listDirectory,
  "fs.search": searchFiles,
  "fs.read_meta": readMetadata,
  "fs.mkdir": makeDirectory,
  "fs.move": movePath,
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
