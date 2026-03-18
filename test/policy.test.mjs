import test from "node:test";
import assert from "node:assert/strict";

import { normalizeInputPath, resolveAllowedPath } from "../src/policy.mjs";

test("normalizeInputPath converts Windows drive paths to WSL mount paths", () => {
  assert.equal(
    normalizeInputPath("C:\\Users\\Example\\Downloads"),
    "/mnt/c/Users/Example/Downloads",
  );
  assert.equal(
    normalizeInputPath("D:/Work Files/OpenClaw"),
    "/mnt/d/Work Files/OpenClaw",
  );
});

test("resolveAllowedPath accepts a Windows absolute path inside allowed roots", () => {
  const config = {
    allowedRoots: ["/mnt/c/Users/Example/Downloads", "/mnt/c/Users/Example/Documents"],
    stagingDir: "/tmp/staging",
  };
  assert.equal(
    resolveAllowedPath(config, "C:\\Users\\Example\\Downloads"),
    "/mnt/c/Users/Example/Downloads",
  );
});

test("resolveAllowedPath rejects Windows absolute paths outside allowed roots", () => {
  const config = {
    allowedRoots: ["/mnt/c/Users/Example/Downloads"],
    stagingDir: "/tmp/staging",
  };
  assert.throws(
    () => resolveAllowedPath(config, "C:\\Windows\\System32"),
    /outside allowed roots/,
  );
});

test("resolveAllowedPath accepts natural root aliases like desktop and downloads", () => {
  const config = {
    allowedRoots: [
      "/mnt/c/Users/Example/OneDrive/Desktop",
      "/mnt/c/Users/Example/Downloads",
    ],
    stagingDir: "/tmp/staging",
  };
  assert.equal(resolveAllowedPath(config, "desktop"), "/mnt/c/Users/Example/OneDrive/Desktop");
  assert.equal(
    resolveAllowedPath(config, "downloads/openclaw"),
    "/mnt/c/Users/Example/Downloads/openclaw",
  );
});
