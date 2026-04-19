---
security_evidence:
  review_areas:
    - runtime
    - delivery
  findings:
    - F-019
  risks:
    - R-019
  workstreams:
    - WS-019
---

# Change Record

## Summary

- Date: 2026-04-19
- Short title: Separate legacy tmux launchers and fail closed on ambiguous recovery profile selection
- Environment: Platform-Core WSL host-control recovery path
- Severity: High

## Classification

- Type: operator workflow hardening
- User-facing impact: Stage host-control recovery can no longer silently drift back to the prod bridge owner when one token authorizes multiple profiles.

## Ownership

- Owning repo or layer: `openclaw-host-bridge`
- Related repos:
  - `platform-engineering`
  - `openclaw-telegram-enhanced`

## Root Cause

- Immediate failure: the host recovery surface still mixed supported `systemd` ownership with legacy tmux launchers and defaulted to the first authorized bridge profile when no explicit target was supplied.
- Actual root cause: legacy/manual fallback files were still presented near the current deployment surface, and the recovery selector tolerated ambiguous profile authorization instead of failing closed.
- Why it escaped earlier controls: the repo had no test that enforced legacy-file separation or explicit profile targeting rules.

## Source Changes

- Repo: `openclaw-host-bridge`
- Commit(s): Local worktree only
- Guardrail added:
  - moved manual fallback launchers under `scripts/legacy/`
  - added `scripts/legacy/README.md`
  - added recovery-profile selection unit tests
  - updated deployment and recovery docs to separate supported vs legacy paths

## Artifact And Deployment Evidence

- Packaged artifact: None
- Related platform or release evidence: None
- Build or workflow evidence: `npm test`; `node --check scripts/openclaw-host-recovery-server.mjs`

If not applicable, write `None`.

## Live Verification

- Validation: `npm test` and `node --check scripts/openclaw-host-recovery-server.mjs` passed after the selector and layout changes.
- Runtime or stage evidence: Live stage bridge recovery was already restored earlier in the session; this change hardens the repo path so the same ambiguity does not recur.
- Residual risk: legacy/manual fallback still exists for maintenance windows, so cross-repo docs must keep pointing operators at the supported `systemd` path first.

## Follow-Up

- Required follow-up: Land the matching platform and Telegram changes together so operator docs, recovery selection, and caller payloads stay aligned.
- Optional hardening: Add a repo-local validator for deployment-doc path separation if more legacy surfaces are introduced later.
- Owner: `openclaw-host-bridge`
