export const READ_OPERATIONS = new Set([
  "health.check",
  "fs.list",
  "fs.search",
  "fs.read_meta",
  "browser.tabs.list",
]);

export const ORGANIZE_OPERATIONS = new Set(["fs.mkdir", "fs.move"]);
export const EXPORT_OPERATIONS = new Set(["fs.zip_for_export", "fs.stage_for_telegram"]);
export const BROWSER_INSPECT_OPERATIONS = new Set(["browser.tabs.inspect"]);

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
  return "admin_high_risk";
}
