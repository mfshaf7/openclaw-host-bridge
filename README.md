# pc-control-bridge

`pc-control-bridge` is a host-side bridge for OpenClaw `pc-control`.

Use it when:

- OpenClaw runs in an isolated container or VM
- you want OpenClaw to work with your real Windows files
- you do not want to patch OpenClaw core just to reach the host PC

Current v1 focus:

- file listing
- file search
- metadata inspection
- folder organization

## Supported mode

This repository currently documents one publishable v1 mode:

- Windows host
- WSL2-backed bridge runtime
- isolated OpenClaw runtime
- OpenClaw plugin + skill on the OpenClaw side

This is an extension pattern, not an OpenClaw core patch.

## Quick Start

1. Install WSL2 and a distro such as `Ubuntu`.
2. Install Node inside WSL.
3. Copy `config/policy.wsl.example.json` to a local policy file and replace:
   - `<windows-user>`
   - `<wsl-user>`
   - `<project-dir>`
4. Start the bridge inside WSL:

```bash
node src/index.mjs
```

or use the provided startup scripts under `scripts/`.

5. In OpenClaw, enable the `pc-control` plugin with:
   - `bridgeUrl: "http://host.docker.internal:48721"`
   - `authTokenEnv: "OPENCLAW_GATEWAY_TOKEN"`
6. Start with read-only mode.
7. Turn on organize mode later if you want `mkdir` and `move`.

## What You Install

You need three pieces:

1. `pc-control-bridge`
   - this repo
   - runs on the Windows host through WSL

2. `pc-control` OpenClaw plugin
   - exposes typed tools to OpenClaw

3. `pc-control` skill
   - gives the model the workflow and usage guidance

## What Works Today

- read-only host access: working
- organize actions: working
- export flow: not complete
- browser inspection: not complete

## Recommended First Config

Start with:

- `read: true`
- `organize: false`
- `export: false`
- `browser_inspect: false`

Then enable organize mode only after read-only calls are working.

## Docs

- [Architecture](docs/architecture.md)
- [WSL Mode](docs/wsl-mode.md)
- [Install Guide](docs/install.md)
- [Security Model](docs/security-model.md)
- [Known Limitations](docs/limitations.md)

## Important limitation

Windows silent persistence should currently be treated as beta and validated per environment.
