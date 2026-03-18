# Install Guide

## 1. Prepare WSL

Install WSL2 and a distro such as `Ubuntu`.

Inside WSL, ensure Node is installed and available to the bridge runtime.

## 2. Configure bridge policy

Start from the example WSL policy and customize:

- Windows user paths under `/mnt/c/Users/<windows-user>/...`
- staging directory
- audit directory
- permission flags

Recommended starting mode:

- `read: true`
- `organize: false`
- `export: false`
- `browser_inspect: false`

## 3. Install OpenClaw-side pieces

Install:

- the `pc-control` skill
- the `pc-control` OpenClaw plugin

Recommended plugin profile:

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

## 4. Start the bridge

Use the WSL startup script or daemon wrapper.

For organize mode, enable:

- plugin `allowWriteOperations: true`
- bridge policy `organize: true`

## 5. Validate

Verify:

- bridge health endpoint responds
- `pc-control` plugin is loaded in OpenClaw
- read-only tool calls work

Then enable organize mode and verify `fs.mkdir` / `fs.move`.
