# WSL Mode

## Purpose

This document explains the current WSL-backed operating mode of `pc-control-bridge`.

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
- startup/persistence is handled through the provided scripts and launcher path

## What Is Configurable

- WSL distro name
- bridge root path
- policy path
- Node path
- allowed roots
- staging directory
- audit directory

## What This Mode Is Not

It is not:

- a native Windows service build
- a zero-prerequisite host-control path
- a direct replacement for OpenClaw runtime isolation

It is a practical bridge mode for Windows + WSL environments.
