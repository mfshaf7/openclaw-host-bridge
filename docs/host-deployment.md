# Host Deployment

## Purpose

This document explains the actual host deployment bundle for `openclaw-host-bridge` in the supported Windows + WSL mode.

It exists because bridge source alone is not enough. Operators need to know:

- which committed files make up the host deployment path
- which files stay local and untracked
- how the bridge is kept alive after the launching shell exits

## Supported Host Runtime Shape

The supported host deployment shape is:

- Windows host
- WSL2 distro such as `Platform-Core`
- bridge runtime executed inside WSL
- persistence owned by `systemd` inside WSL
- Windows-side startup through the `PlatformCoreHostStack` scheduled task

For the current enterprise-standard shape:

- `openclaw-host-bridge.service` is the steady-state prod bridge instance
- `openclaw-host-bridge-stage.service` is an on-demand stage-only bridge
  instance
- the stage bridge should be started only for active stage test windows and
  stopped again when stage is suspended

## Committed Host Deployment Files

These committed files make up the supported host deployment bundle:

- `src/`
- `config/policy.example.json`
- `config/policy.wsl.example.json`
- `scripts/run_bridge_operation.mjs`
- `scripts/run_bridge_operation_isolated.sh`
- `scripts/run_windows_command.py`
- `scripts/start-openclaw-host-bridge.sh`
- `scripts/start-openclaw-host-recovery.sh`
- `scripts/run-openclaw-host-bridge-supervisor.sh`
- `scripts/run-openclaw-host-recovery-supervisor.sh`
- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-recovery-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`
- `scripts/stop-openclaw-host-stack.sh`
- `scripts/status-openclaw-host-stack.sh`

Windows task registration for the supported production path is no longer owned
by this repository. Use the rendered bootstrap artifact from
`platform-engineering/ansible/generated/openclaw-host-stack-windows-bootstrap.ps1`.

## Local Files Operators Must Create

Operators are still expected to create local, untracked runtime files such as:

- `config/policy.local.json`
- `config/policy.stage.local.json`
- local logs
- local audit output
- local secret-bearing environment state

These should not be committed.

The bridge should execute privileged host operations from a committed bridge
revision, not from ad hoc local-only script drift in a dirty checkout. If an
incident requires a live host-side repair, backport the exact helper-script
change into this repository and redeploy the committed bundle.

## Persistence Model

Foreground validation:

- `scripts/start-openclaw-host-bridge.sh`
- `scripts/start-openclaw-host-recovery.sh`

Supported persistent WSL host mode:

- `systemctl start openclaw-host-stack.target`
- `platform-engineering/ansible/generated/openclaw-host-stack-windows-bootstrap.ps1`
- `systemctl start openclaw-host-bridge-stage.service` only during active stage
  gateway test windows

Legacy/manual persistent mode:

- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-recovery-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`

Restart loop inside WSL:

- `scripts/run-openclaw-host-bridge-supervisor.sh`
- `scripts/run-openclaw-host-recovery-supervisor.sh`

## Why tmux Still Exists

The bridge still ships tmux helpers for manual maintenance windows and fallback
operation.

`tmux` is used because it provides:

- a detached WSL session
- a persistent process host
- a way to inspect the running host session later

For the current `Platform-Core` deployment, `systemd` is the supported runtime
owner and Windows only provides the logon-triggered WSL entry through the
platform-engineering bootstrap artifact.

## Verification Standard

A correct host deployment is not just “the launcher returned success.”

Verify all of:

1. the bridge process exists in WSL
2. the recovery process exists in WSL
3. the bridge answers on its internal listener and reports runtime attestation
4. the recovery listener answers on its internal listener
5. Windows-side forwarding or reachability works
6. the isolated runtime can reach the bridge and recovery listener
7. a real self-heal callback succeeds

Operational helpers:

- `scripts/status-openclaw-host-stack.sh`
- `scripts/stop-openclaw-host-stack.sh`

The bridge `/healthz` output is expected to include enough runtime evidence to
answer:

- which repo or artifact is running
- which config path is active
- which environment file is expected
- which OpenClaw home root the bridge believes it is serving
- which staging, quarantine, and audit directories are active
- whether those directories align with the active `OPENCLAW_CONFIG_PATH` home
- which PID is serving
- which commit and package version the process loaded

If an operator cannot prove those facts from the live bridge plus `systemd`,
the host deployment is not at the supported enterprise standard yet.

## Environment Root Alignment

The bridge policy file is local and untracked, but it still has to align with
the environment home that the service is serving.

If `OPENCLAW_CONFIG_PATH` points at `/home/<user>/.openclaw/...`, then the
bridge policy should normally stage and audit under that same
`/home/<user>/.openclaw` root. If it points at
`/home/<user>/.openclaw-stage/...`, then the policy should normally stage and
audit under `/home/<user>/.openclaw-stage`.

When stage and prod are not intended to run host-control concurrently on the
same listener, prefer:

- one always-on prod bridge instance rooted at `.openclaw`
- one disabled-by-default stage bridge instance rooted at `.openclaw-stage`
- explicit start on stage resume and explicit stop on stage suspend

Do not run one shared bridge instance with stage-rooted `staging_dir` and
prod-rooted `sharedPathMap`, or the reverse. That causes real delivery drift:

- screenshots and staged files are returned with the wrong environment root
- Telegram delivery rejects media as outside the allowed local directory
- audit evidence lands under the wrong environment

Operator tracking:

- [docs/operator-follow-up-checklist.md](operator-follow-up-checklist.md)
- [docs/host-control-capability-matrix.md](host-control-capability-matrix.md)

## Relationship To The Deployment Workspace

In a multi-repo workspace:

- this repository is the canonical host bridge runtime source
- `platform-engineering/products/openclaw/architecture-and-owner-model.md`
  documents the current platform-side OpenClaw architecture and owner model
- `security-architecture/docs/architecture/domains/host-control.md`
  documents the security posture for host-control
