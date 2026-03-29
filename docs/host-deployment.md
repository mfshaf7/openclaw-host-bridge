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
- WSL2 distro such as Ubuntu
- bridge runtime executed inside WSL
- persistence provided by a detached `tmux` session
- Windows-side startup through a PowerShell launcher or scheduled task

## Committed Host Deployment Files

These committed files make up the supported host deployment bundle:

- `src/`
- `config/policy.example.json`
- `config/policy.wsl.example.json`
- `scripts/start-openclaw-host-bridge.sh`
- `scripts/start-openclaw-host-recovery.sh`
- `scripts/run-openclaw-host-bridge-supervisor.sh`
- `scripts/run-openclaw-host-recovery-supervisor.sh`
- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-recovery-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`
- `scripts/stop-openclaw-host-stack.sh`
- `scripts/status-openclaw-host-stack.sh`
- `scripts/start-openclaw-host-bridge-hidden.ps1`
- `scripts/start-openclaw-host-stack-hidden.ps1`
- `scripts/register-openclaw-host-bridge-task.ps1`
- `scripts/register-openclaw-host-stack-task.ps1`

## Local Files Operators Must Create

Operators are still expected to create local, untracked runtime files such as:

- `config/policy.local.json`
- local logs
- local audit output
- local secret-bearing environment state

These should not be committed.

## Persistence Model

Foreground validation:

- `scripts/start-openclaw-host-bridge.sh`
- `scripts/start-openclaw-host-recovery.sh`

Persistent WSL host mode:

- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-recovery-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`

Restart loop inside WSL:

- `scripts/run-openclaw-host-bridge-supervisor.sh`
- `scripts/run-openclaw-host-recovery-supervisor.sh`

Windows launcher:

- `scripts/start-openclaw-host-bridge-hidden.ps1`
- `scripts/start-openclaw-host-stack-hidden.ps1`

Windows logon task:

- `scripts/register-openclaw-host-bridge-task.ps1`
- `scripts/register-openclaw-host-stack-task.ps1`

## Why tmux Is Used

The bridge needs a WSL-native persistent host that survives the launching shell.

`tmux` is used because it provides:

- a detached WSL session
- a persistent process host
- a way to inspect the running host session later

This is more reliable than assuming a one-off hidden shell process will remain the true lifetime owner of the bridge.

## Verification Standard

A correct host deployment is not just “the launcher returned success.”

Verify all of:

1. the bridge process exists in WSL
2. the recovery process exists in WSL
3. the bridge answers on its internal listener
4. the recovery listener answers on its internal listener
5. Windows-side forwarding or reachability works
6. the isolated runtime can reach the bridge and recovery listener
7. a real self-heal callback succeeds

Operational helpers:

- `scripts/status-openclaw-host-stack.sh`
- `scripts/stop-openclaw-host-stack.sh`

Operator tracking:

- [docs/operator-follow-up-checklist.md](operator-follow-up-checklist.md)
- [docs/host-control-capability-matrix.md](host-control-capability-matrix.md)

## Relationship To The Deployment Workspace

In a multi-repo workspace:

- this repository is the canonical host bridge runtime source
- `openclaw-isolated-deployment` documents the system-wide deployment model
- `openclaw-isolated-deployment/openclaw-host-bridge/` is documentation-oriented and should not be mistaken for the runnable bridge source tree
