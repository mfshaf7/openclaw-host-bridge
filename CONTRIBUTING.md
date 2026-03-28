# Contributing

## Scope

This repository focuses on the host-side `openclaw-host-bridge` and its documented WSL-backed Windows mode.

## Contribution priorities

- make configuration more portable
- improve startup reliability
- improve policy enforcement
- keep host access constrained and auditable

## Non-goals

- patching OpenClaw core for local host assumptions
- turning the bridge into unrestricted remote shell by default

## Pull requests

- document any new host prerequisite clearly
- keep machine-specific values out of committed defaults
- prefer additive changes to supported modes instead of hidden local hacks
