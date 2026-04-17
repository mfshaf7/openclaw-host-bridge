# openclaw-host-bridge Agent Notes

This repository is the canonical runnable host-side enforcement layer for
OpenClaw host control.

## What This Repo Owns

- host-side operation dispatch
- allowed-root enforcement
- export staging
- audit logging
- runtime attestation
- WSL and Windows-oriented host runtime workflows

It does not own Telegram UX, tool exposure inside the gateway, or environment
promotion.

## Read First

- `README.md`
- `docs/architecture.md`
- `docs/security-model.md`
- `docs/wsl-mode.md`
- `docs/host-deployment.md`
- `docs/install.md`
- `docs/records/change-records/README.md`
- `security-architecture/docs/architecture/components/openclaw-host-bridge/README.md`
- `security-architecture/docs/architecture/domains/host-control.md`
- `security-architecture/docs/reviews/security-review-checklist.md`
- `security-architecture/docs/reviews/components/2026-04-18-openclaw-host-bridge-security-baseline.md`

## Working Rules

- Treat this repo as the host trust boundary. Do not collapse host policy into
  Telegram logic, platform rollout code, or generic shell access.
- If a live host fix is required, backport it here and update the deployment or
  runbook path in the same work.
- Keep policy alignment, audit visibility, and runtime attestation intact after
  any change.
- If stage and prod host behavior diverge, prefer explicit environment-scoped
  policy or service wiring over hidden local drift.

## Validation

- `node --test test/*.test.mjs`
- `npm run validate:governance-docs` when change-record evidence changes
- `npm run validate:change-record-requirement` for PR-shaped bridge changes that should emit a security-tagged change record
- useful live checks:
  - `bash scripts/status-openclaw-host-stack.sh`
  - `curl http://127.0.0.1:48721/healthz`
  - `curl http://127.0.0.1:48731/healthz` for the on-demand stage bridge
