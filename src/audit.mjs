import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export async function writeAudit(config, entry) {
  const timestamp = new Date().toISOString();
  const date = timestamp.slice(0, 10);
  const auditId = crypto.randomUUID();
  const line = JSON.stringify({
    audit_id: auditId,
    timestamp,
    ...entry,
  });
  const filePath = path.join(config.auditDir, `${date}.jsonl`);
  await fs.appendFile(filePath, `${line}\n`, "utf8");
  return auditId;
}
