import test from "node:test";
import assert from "node:assert/strict";

import { normalizeInputPath, resolveAllowedPath } from "../src/policy.mjs";

test("normalizeInputPath converts Windows drive paths to WSL mount paths", () => {
  assert.equal(
    normalizeInputPath("C:\\Users\\Sevensoul\\Downloads"),
    "/mnt/c/Users/Sevensoul/Downloads",
  );
  assert.equal(
    normalizeInputPath("D:/Work Files/OpenClaw"),
    "/mnt/d/Work Files/OpenClaw",
  );
});

test("resolveAllowedPath accepts a Windows absolute path inside allowed roots", () => {
  const config = {
    allowedRoots: ["/mnt/c/Users/Sevensoul/Downloads", "/mnt/c/Users/Sevensoul/Documents"],
    stagingDir: "/tmp/staging",
  };
  assert.equal(
    resolveAllowedPath(config, "C:\\Users\\Sevensoul\\Downloads"),
    "/mnt/c/Users/Sevensoul/Downloads",
  );
});

test("resolveAllowedPath rejects Windows absolute paths outside allowed roots", () => {
  const config = {
    allowedRoots: ["/mnt/c/Users/Sevensoul/Downloads"],
    stagingDir: "/tmp/staging",
  };
  assert.throws(
    () => resolveAllowedPath(config, "C:\\Windows\\System32"),
    /outside allowed roots/,
  );
});
