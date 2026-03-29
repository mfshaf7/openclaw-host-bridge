# Operator Follow-Up Checklist

This document is the operator-facing backlog for the current host-control setup.

Use it to track what is already stable, what still needs verification, and what
should be revisited in a future maintenance window.

## Current Baseline

| Area | Current state | Evidence | Next revisit |
| --- | --- | --- | --- |
| Telegram host-control topic routing | Working | Live self-heal requests now route and reply | Add broader regression coverage for topic-bound commands |
| Bridge runtime | Working | `/healthz` reachable and bridge restart path verified | Keep ownership path simple and documented |
| Recovery runtime | Working | `/healthz` reachable and diagnostics/self-heal reachable | Add repair history output |
| Self-heal for bridge-down scenario | Working | Telegram-triggered repair recovered bridge after forced failure | Add audit trail and explicit repair history |
| Windows logon persistence for full stack | Working | `PlatformCoreHostStack` starts the WSL `systemd` host stack | Verify once after a real reboot/logon |
| Targeted TypeScript check for host-control dispatcher | Working | `npx tsc -p tsconfig.host-control-check.json` passes | Expand checks only when SDK typing is available |

## Reboot Checklist

Run this after a real Windows reboot and logon:

- confirm scheduled task `PlatformCoreHostStack` is present and `Ready`
- confirm `openclaw-host-stack.target` is active
- confirm `openclaw-host-bridge.service` is active
- confirm `openclaw-host-recovery.service` is active
- confirm bridge `/healthz` returns `200`
- confirm recovery `/healthz` returns `200`
- confirm Telegram host-control topic still answers `host status`
- confirm Telegram `self heal` still produces a proposal and completes

## Self-Heal Follow-Ups

| Item | Priority | Status | Notes |
| --- | --- | --- | --- |
| Add repair history command | High | Pending | Telegram should show recent self-heal attempts and outcomes |
| Persist repair attempts to an append-only log | High | Pending | Needed for operational trust without manual log reads |
| Add status classes (`healthy`, `degraded`, `repairing`, `unreachable`) | High | Pending | Current replies are better, but still mostly text |
| Add startup self-check summary on bridge/recovery boot | Medium | Pending | Useful after reboot and after maintenance |
| Define exact self-heal recovery boundary | Medium | Pending | Document what happens when recovery itself is fully down |

## Broader Setup Follow-Ups

| Item | Priority | Status | Notes |
| --- | --- | --- | --- |
| Consolidate runtime ownership model | High | In progress | Windows task now starts `systemd`; continue reducing legacy script assumptions |
| Reduce config drift between repo copies and live runtime | High | Improved | `/opt` rollback copies are gone; keep source-of-truth in the migrated repos |
| Add one-shot full operator status view | High | In progress | `host status` exists; extend it into a broader operator summary later |
| Add admin-action audit log | Medium | Pending | Covers writes, allowed-root changes, repairs, restarts |
| Create maintenance checklist for future changes | Medium | Pending | Before/after validation for safe updates |

## Change Discipline

When touching this setup again:

- prefer additive changes over replacing live startup paths
- update this checklist and the capability matrix in the same change
- validate through live health endpoints before and after any cutover
- avoid broad refactors unless there is a concrete failure to solve
