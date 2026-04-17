---
security_evidence:
  review_areas:
    - runtime
  findings:
    - F-006
  risks:
    - R-006
  workstreams:
    - WS-006
---

# Change Record

## Summary

- Date: 2026-04-17
- Short title: Bridge interface contract is now published for downstream validation
- Environment: shared source contract
- Severity: medium

## Classification

- Type: deployment/artifact bug
- User-facing impact: downstream repos previously had to infer bridge behavior
  from private source text, which increased drift risk around a high-trust host
  boundary.

## Ownership

- Owning repo or layer: `openclaw-host-bridge`
- Related repos: `openclaw-runtime-distribution`, `workspace-governance`

## Root Cause

- Immediate failure: there was no owner-published contract file for the bridge
  seam, so downstream verification relied on source grep and local knowledge.
- Actual root cause: the canonical bridge repo exposed runtime behavior and
  tests, but it did not publish a narrow machine-readable contract for the
  distribution and governance layers to consume.
- Why it escaped earlier controls: build and runtime checks proved the bridge
  locally, but they did not prove that downstream consumers were pinned to a
  stable declared surface.

## Source Changes

- Repo: `openclaw-host-bridge`
- Commit(s): `e14f980`
- Guardrail added:
  - published `contracts/interface-manifest.json`
  - added `npm run test:interface-contract`

## Artifact And Deployment Evidence

- Packaged artifact: `contracts/interface-manifest.json`
- Related platform or release evidence:
  `workspace-governance/contracts/components.yaml`
- Build or workflow evidence: downstream contract verification now consumes the
  owner-published manifest instead of grepping private bridge source

## Live Verification

- Validation:
  - `npm run test:interface-contract`
- Runtime or stage evidence:
  - `openclaw-runtime-distribution` and `workspace-governance` both validate
    the published bridge contract successfully
- Residual risk: source and contract can still drift if future bridge changes
  bypass the manifest, so the owner repo must keep the manifest and local
  contract test in the same change.

## Follow-Up

- Required follow-up: keep contract-manifest updates in the same PR as any
  externally visible bridge behavior change.
- Optional hardening: publish a compatibility version in the manifest if bridge
  consumers eventually need explicit version negotiation.
- Owner: Host bridge maintainers
