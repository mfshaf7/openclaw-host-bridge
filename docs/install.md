# Install Guide

## Goal

At the end of this guide you should have:

- the bridge running inside WSL
- OpenClaw able to reach it at `http://host.docker.internal:48721`
- read-only host access working first
- organize mode optional after validation

## 1. Prepare WSL

Install:

- WSL2
- a distro such as `Ubuntu`
- Node inside WSL

Confirm Node works:

```bash
node --version
```

## 2. Create a local bridge policy

Start from:

- `config/policy.wsl.example.json`

Create a local copy, for example:

- `config/policy.local.json`

Replace these placeholders:

- `<windows-user>`
- `<wsl-user>`
- `<project-dir>`

Typical values you need to set:

- `allowed_roots`
- `staging_dir`
- `audit.dir`

Recommended first policy:

```json
{
  "permissions": {
    "read": true,
    "organize": false,
    "export": false,
    "browser_inspect": false,
    "admin_high_risk": false
  }
}
```

## 3. Verify the bridge once in WSL

Simplest first run:

```bash
export PC_CONTROL_BRIDGE_CONFIG=/path/to/policy.local.json
node src/index.mjs
```

If that works, move to the hidden startup path.

Expected success output:

```json
{"ok":true,"service":"pc-control-bridge","host":"0.0.0.0","port":48721}
```

## 4. Check bridge health

From the machine that runs OpenClaw, verify:

```bash
curl http://host.docker.internal:48721/healthz
```

You should get a JSON response with `ok: true`.

## 5. Install the hidden startup path

Copy the Windows launcher:

```bash
cp scripts/start-pc-control-bridge-hidden.ps1 /mnt/c/Users/<windows-user>/AppData/Local/Temp/start-pc-control-bridge-hidden.ps1
```

Register the Scheduled Task from WSL:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(wslpath -w scripts/register-pc-control-bridge-hidden-task.ps1)"
```

The task should be named `OpenClawPcControlBridge`.

Expected result:

- `LastTaskResult : 0`
- the bridge stays reachable at `http://host.docker.internal:48721/healthz`
- no visible command window is required

## 6. Install OpenClaw-side pieces

Install:

- the `pc-control` skill
- the `pc-control` plugin

Install the plugin through the managed installer from the OpenClaw checkout:

```bash
openclaw plugins install ./pc-control-openclaw-plugin
```

That records `plugins.installs` provenance and avoids the
`loaded without install/load-path provenance` warning for `pc-control`.

Recommended starting plugin profile:

```json
{
  "plugins": {
    "entries": {
      "pc-control": {
        "enabled": true,
        "config": {
          "enabled": true,
          "bridgeUrl": "http://host.docker.internal:48721",
          "authTokenEnv": "OPENCLAW_GATEWAY_TOKEN",
          "timeoutMs": 10000,
          "allowWriteOperations": false,
          "allowExportOperations": false,
          "allowBrowserInspect": false
        }
      }
    }
  }
}
```

Recommended gateway hardening for the paired OpenClaw runtime when the Docker
deployment keeps `gateway.bind` beyond loopback:

- keep gateway auth in `token` mode
- add `gateway.auth.rateLimit`
- restrict the forwarded OpenClaw ports at the Windows host firewall layer if
  Docker/WSL cannot safely enforce localhost-only publishing

## 7. Validate read-only mode

Check:

- the plugin is loaded in OpenClaw
- `health.check` works
- `fs.list` works
- `fs.search` works
- `fs.read_meta` works

Do not enable organize mode until these work cleanly.

Recommended Telegram checks:

- `check my downloads folder`
- `find OpenClaw files in my downloads`
- `show details for C:\Users\<windows-user>\Downloads\<file-name>`

The goal is for natural host-PC phrasing to work without forcing the user to say `use pc-control`.

## 8. Enable organize mode

To enable folder creation and moves:

1. set plugin `allowWriteOperations: true`
2. set bridge policy `organize: true`

Even then, mutating calls should require:

- `confirm: true`

Recommended Telegram write checks:

- `create a folder called Test in my downloads and confirm it`
- `move <file> into my For Review folder and confirm it`

## 9. Treat export and browser inspection separately

Do not enable these by default:

- `allowExportOperations`
- `allowBrowserInspect`

They are a separate risk class from read-only and organize actions.
