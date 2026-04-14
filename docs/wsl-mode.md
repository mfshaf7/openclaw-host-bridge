# WSL Mode

## Purpose

This document explains the current WSL-backed operating mode of `openclaw-host-bridge`.

## Supported Shape

This mode assumes:

- Windows host
- WSL2 installed and working
- bridge runtime inside WSL
- OpenClaw running separately in an isolated container or VM

## Why This Mode Exists

OpenClaw running in a container or VM does not automatically gain controlled access to the Windows host. The bridge provides that host path without moving the runtime onto the workstation itself.

## Runtime Model

- the bridge process runs inside WSL
- Windows files are accessed through `/mnt/<drive>/...`
- the isolated runtime reaches the bridge over HTTP on the host side
- startup/persistence is handled through the provided WSL scripts plus the
  platform-engineering Windows bootstrap artifact
- the supported persistent host mode on `Platform-Core` uses Windows logon to
  enter WSL and `systemd` to own the bridge and recovery services

## What Is Configurable

- WSL distro name
- bridge root path
- policy path
- Node path
- allowed roots
- staging directory
- audit directory
- Windows health snapshot path (`OPENCLAW_WINDOWS_HEALTH_SNAPSHOT`)

## What This Mode Is Not

It is not:

- a native Windows service build
- a zero-prerequisite host-control path
- a direct replacement for OpenClaw runtime isolation

It is a practical bridge mode for Windows + WSL environments.

## Persistence Path

Recommended persistence flow:

1. `scripts/start-openclaw-host-bridge.sh` for foreground validation
2. `systemctl start openclaw-host-stack.target` inside WSL for the supported
   persistent host path
3. `platform-engineering/ansible/generated/openclaw-host-stack-windows-bootstrap.ps1`
   for Windows-side startup
4. `scripts/platform-core-windows-health.ps1` plus
   `scripts/launch-platform-core-windows-health.cmd` for Windows-side health snapshot refresh

Legacy/manual fallback flow:

- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`

If you want the bridge and recovery listener to come up from the same stable
config root, use:

- `openclaw-host-stack.target` for the supported `Platform-Core` path
- `scripts/start-openclaw-host-stack-tmux.sh` only as a manual legacy fallback

Read:

- [docs/host-deployment.md](host-deployment.md)
- [docs/recovery-cutover.md](recovery-cutover.md)
