# Recovery Cutover

## Purpose

This document describes the safer rollout path for the host recovery service.

The goal is to improve self-heal reliability without replacing a currently
working live setup blindly.

For ongoing operator follow-up after the cutover, use:

- [docs/operator-follow-up-checklist.md](operator-follow-up-checklist.md)
- [docs/host-control-capability-matrix.md](host-control-capability-matrix.md)

## Current Risk

Older recovery startup depended on inherited shell or `tmux` environment state.

That is fragile because:

- the recovery process can start without the expected token
- restart behavior can differ depending on which shell launched `tmux`
- self-heal can fail even when bridge and Telegram routing are otherwise correct

## Safer Rollout

The repository now supports a more deterministic recovery startup path:

- `scripts/openclaw-host-recovery-server.mjs` loads config/token from stable config paths
- `scripts/start-openclaw-host-recovery.sh` owns recovery pid/lock/log behavior
- `scripts/start-openclaw-host-recovery-tmux.sh` exports stable config paths into the session
- `scripts/run-openclaw-host-recovery-supervisor.sh` provides a restart loop similar to the bridge
- `openclaw-host-stack.target` starts both bridge and recovery under `systemd`
- `scripts/start-openclaw-host-stack-tmux.sh` remains available only as a manual fallback

Rollout order:

1. keep the current live setup running
2. validate the new recovery startup in a separate maintenance window
3. confirm `/healthz` and `/v1/self-heal` from the isolated runtime
4. only then switch the Windows-side launcher to the new stack entrypoint if desired

## Rollback

Rollback should be operationally cheap.

Rollback steps:

1. stop the new recovery or stack owner:
   - `systemctl stop openclaw-host-stack.target`
   - or, for legacy fallback sessions only:
   - `tmux kill-session -t openclaw-host-recovery`
   - `tmux kill-session -t openclaw-host-bridge`
2. restart the previously known-good manual path
3. verify:
   - bridge health
   - recovery health
   - one real self-heal callback

Operator helpers:

- `scripts/status-openclaw-host-stack.sh`
- `scripts/stop-openclaw-host-stack.sh`

Because the new scripts are additive, rollback is just “stop using them”.

## Recommended Verification

Verify from the OpenClaw gateway side:

1. `bridge /healthz`
2. `recovery /healthz`
3. authorized `POST /v1/self-heal` with `recheck_health`
4. one real Telegram self-heal confirmation flow
