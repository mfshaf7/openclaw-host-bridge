export const READ_OPERATIONS = new Set([
  "health.check",
  "config.allowed_roots.list",
  "config.host_discovery.overview",
  "config.host_discovery.browse",
  "fs.list",
  "fs.search",
  "fs.read_meta",
  "browser.tabs.list",
]);

export const ORGANIZE_OPERATIONS = new Set(["fs.mkdir", "fs.move", "fs.quarantine"]);
export const EXPORT_OPERATIONS = new Set(["fs.zip_for_export", "fs.stage_for_telegram", "display.screenshot"]);
export const BROWSER_INSPECT_OPERATIONS = new Set(["browser.tabs.inspect"]);
export const ADMIN_HIGH_RISK_OPERATIONS = new Set([
  "config.allowed_roots.add",
  "config.allowed_roots.remove",
  "display.monitor_power",
]);

export function permissionForOperation(operation) {
  if (READ_OPERATIONS.has(operation)) {
    return "read";
  }
  if (ORGANIZE_OPERATIONS.has(operation)) {
    return "organize";
  }
  if (EXPORT_OPERATIONS.has(operation)) {
    return "export";
  }
  if (BROWSER_INSPECT_OPERATIONS.has(operation)) {
    return "browser_inspect";
  }
  if (ADMIN_HIGH_RISK_OPERATIONS.has(operation)) {
    return "admin_high_risk";
  }
  return "admin_high_risk";
}
