import fs from "node:fs";
import { loadConfig } from "../src/config.mjs";
import { dispatch } from "../src/dispatcher.mjs";

async function main() {
  const payloadPath = process.argv[2];
  if (!payloadPath) {
    throw new Error("usage: run_bridge_operation.mjs <payload-json>");
  }
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
  const config = await loadConfig();
  const result = await dispatch(config, payload.operation, payload.args || {});
  process.stdout.write(JSON.stringify({ ok: true, result }));
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: {
        code: error?.code || "internal_error",
        message: String(error?.message || error),
      },
    }),
  );
  process.exitCode = 1;
});
