import test from "node:test";
import assert from "node:assert/strict";

import {
  inferTargetProfileFromBridgeUrl,
  normalizeTargetProfile,
  requestedBridgeProfileId,
  resolveAuthorizedBridgeProfile,
} from "../src/recovery-profile-selection.mjs";

const sharedProfiles = [
  { id: "prod", token: "shared-token", bridgePort: 48721 },
  { id: "stage", token: "shared-token", bridgePort: 48731 },
];

test("normalizes supported target profile aliases", () => {
  assert.equal(normalizeTargetProfile("prod"), "prod");
  assert.equal(normalizeTargetProfile("stage"), "stage");
  assert.equal(normalizeTargetProfile("default"), "prod");
  assert.equal(normalizeTargetProfile(""), null);
});

test("infers the requested profile from explicit bridge targeting", () => {
  assert.equal(
    inferTargetProfileFromBridgeUrl("http://127.0.0.1:48731", sharedProfiles),
    "stage",
  );
  assert.equal(
    requestedBridgeProfileId({ bridgeUrl: "http://127.0.0.1:48721" }, sharedProfiles),
    "prod",
  );
});

test("requires an explicit target when one token matches prod and stage", () => {
  const result = resolveAuthorizedBridgeProfile("shared-token", { action: "diagnostics" }, sharedProfiles);
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.equal(result.error.code, "target_profile_required");
});

test("selects the requested stage profile when it is explicitly targeted", () => {
  const result = resolveAuthorizedBridgeProfile(
    "shared-token",
    { action: "diagnostics", targetProfile: "stage" },
    sharedProfiles,
  );
  assert.equal(result.ok, true);
  assert.equal(result.profile.id, "stage");
});
