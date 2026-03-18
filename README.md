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
- silent task-owned startup on Windows with a WSL-backed bridge

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
4. Verify the bridge once in WSL:

```bash
export PC_CONTROL_BRIDGE_CONFIG=/path/to/policy.local.json
node src/index.mjs
```

5. After the foreground check passes, switch to the hidden startup path with the scripts under `scripts/`.

6. In OpenClaw, enable the `pc-control` plugin with:
   - `bridgeUrl: "http://host.docker.internal:48721"`
   - `authTokenEnv: "OPENCLAW_GATEWAY_TOKEN"`
7. Start with read-only mode.
8. Turn on organize mode later if you want `mkdir` and `move`.

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

## Telegram Usage

You should not need to say `use pc-control` for obvious host-PC requests.

Natural read-only examples:

- `check my downloads folder`
- `what's in my desktop`
- `find OpenClaw files in my downloads`
- `show details for C:\Users\me\Downloads\report.docx`
- `what browser tabs do I have open`

Natural write examples:

- `create a folder called Test in my downloads and confirm it`
- `move report.docx into my For Review folder and confirm it`

Recommended behavior:

- ordinary host-file and browser questions should route to `pc-control` automatically
- writes should still be explicit and confirmation-gated
- container or VM questions should stay outside `pc-control` unless the user clearly means the host PC

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

Windows silent persistence is supported in this repo, but should still be validated once per environment after install and after a reboot/logon cycle.
