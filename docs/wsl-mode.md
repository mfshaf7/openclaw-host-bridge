# WSL Mode

## Supported mode

This repository currently supports:

- Windows host
- WSL2 distro such as `Ubuntu`
- OpenClaw running separately in an isolated container or VM

## Why this mode exists

OpenClaw running inside a container does not automatically gain access to the real Windows host. The bridge provides that host path without moving OpenClaw itself onto the host.

## What this mode requires

- WSL2 installed and working
- Node installed inside WSL
- access to the local OpenClaw state/config file
- container-to-host connectivity through `host.docker.internal`

## Runtime model

- the bridge runs inside WSL
- the bridge sees Windows files through `/mnt/c/...`
- OpenClaw reaches the bridge over HTTP on the host

## What is configurable

- WSL distro name
- bridge root path
- bridge policy path
- Node binary path
- allowed roots
- staging/audit paths

## What is not yet native

This is not a Windows-native service build yet. It is a WSL-backed host bridge mode.
