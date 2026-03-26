import test from "node:test";
import assert from "node:assert/strict";

import { permissionForOperation } from "../src/types.mjs";

test("permissionForOperation classifies screenshot export correctly", () => {
  assert.equal(permissionForOperation("display.screenshot"), "export");
  assert.equal(permissionForOperation("display.monitor_power"), "admin_high_risk");
});
