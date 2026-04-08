# Install Guide

## Goal

At the end of this guide you should have:

- the bridge running in WSL
- a local policy file in place
- the bridge reachable from the isolated OpenClaw runtime
- read-only host access working before any mutating capability is enabled

## 1. Prepare WSL

Install:

- WSL2
- a Linux distro such as Ubuntu
- Node.js inside WSL

Verify:

```bash
node --version
```

## 2. Create A Local Policy

Start from:

- `config/policy.wsl.example.json`

Create a local copy such as:

- `config/policy.local.json`

Update at least:

- `allowed_roots`
- `staging_dir`
- `audit.dir`
- permission flags

Recommended first posture:

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

## 3. Run The Bridge In Foreground First

```bash
export OPENCLAW_HOST_BRIDGE_CONFIG=/path/to/policy.local.json
node src/index.mjs
```

This is only the first validation step. Do not treat background startup as correct until the foreground run works first.

## 4. Verify Bridge Health

From the side that will run OpenClaw:

```bash
curl http://host.docker.internal:48721/healthz
```

Expected result:

- JSON response with `ok: true`

## 5. Install The Persistent Startup Path

Use the supported `systemd`-owned WSL startup path for persistence.

Relevant scripts:

- `scripts/start-openclaw-host-bridge.sh`
- `scripts/start-openclaw-host-recovery.sh`
- `scripts/run-openclaw-host-bridge-supervisor.sh`
- `scripts/run-openclaw-host-recovery-supervisor.sh`
- `scripts/status-openclaw-host-stack.sh`
- `platform-engineering/ansible/generated/openclaw-host-stack-windows-bootstrap.ps1`

Recommended flow:

1. validate foreground startup first with `scripts/start-openclaw-host-bridge.sh`
2. validate foreground startup for recovery with `scripts/start-openclaw-host-recovery.sh`
3. start the supported persistent stack with `systemctl start openclaw-host-stack.target`
4. verify status with `systemctl status openclaw-host-stack.target openclaw-host-bridge.service openclaw-host-recovery.service`
5. only then wire in the Windows logon task with `platform-engineering/ansible/generated/openclaw-host-stack-windows-bootstrap.ps1`

Legacy/manual fallback only:

- `scripts/start-openclaw-host-bridge-tmux.sh`
- `scripts/start-openclaw-host-stack-tmux.sh`

The exact startup method should be validated once in the target environment after install and after reboot/logon.

## 6. Install OpenClaw-Side Pieces

You still need:

- the OpenClaw-side `host-control` plugin
- the skill or prompt/routing layer that uses it

Recommended plugin path:

```bash
openclaw plugins install ./host-control-openclaw-plugin
```

## 7. Validate Read-Only Mode First

Before enabling any mutating or export action, verify:

- `health.check`
- `fs.list`
- `fs.search`
- `fs.read_meta`

If these are not working cleanly, do not enable organize or export yet.

## 8. Enable Organize Mode Later

Only after read-only mode works:

- enable plugin write mode
- enable bridge organize permission

Mutating operations should still require explicit confirmation.

## 9. Treat Export Separately

Do not enable export just because read-only or organize mode works.

Export changes the risk boundary because it sends host data out through another delivery channel.

## Related Documents

- [docs/wsl-mode.md](wsl-mode.md)
- [docs/host-deployment.md](host-deployment.md)
