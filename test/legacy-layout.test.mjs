import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

const legacyScripts = [
  "start-openclaw-host-bridge-tmux.sh",
  "start-openclaw-host-recovery-tmux.sh",
  "start-openclaw-host-stack-tmux.sh",
  "stop-openclaw-host-stack.sh",
];

const legacyDocs = [
  "README.md",
  "docs/wsl-mode.md",
  "docs/host-deployment.md",
  "docs/install.md",
  "docs/legacy/recovery-cutover.md",
];

test("legacy launchers are isolated under scripts/legacy", () => {
  for (const scriptName of legacyScripts) {
    assert.equal(
      fs.existsSync(path.join(repoRoot, "scripts", scriptName)),
      false,
      `${scriptName} should not stay in the supported scripts root`,
    );
    assert.equal(
      fs.existsSync(path.join(repoRoot, "scripts", "legacy", scriptName)),
      true,
      `${scriptName} should live under scripts/legacy`,
    );
  }
});

test("repo docs reference legacy launchers only through scripts/legacy", () => {
  for (const docPath of legacyDocs) {
    const text = fs.readFileSync(path.join(repoRoot, docPath), "utf8");
    for (const scriptName of legacyScripts) {
      assert.equal(
        text.includes(`scripts/${scriptName}`),
        false,
        `${docPath} should not reference legacy launcher scripts from the supported scripts root`,
      );
    }
  }
});

test("legacy cutover doc is isolated from the current docs root", () => {
  assert.equal(
    fs.existsSync(path.join(repoRoot, "docs", "recovery-cutover.md")),
    false,
    "recovery-cutover.md should not remain in the current docs root",
  );
  assert.equal(
    fs.existsSync(path.join(repoRoot, "docs", "legacy", "recovery-cutover.md")),
    true,
    "recovery-cutover.md should live under docs/legacy",
  );
});
