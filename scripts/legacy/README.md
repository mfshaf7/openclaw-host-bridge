# Legacy Manual Fallback Scripts

These scripts are kept only for manual fallback and maintenance windows.

They are not part of the supported `Platform-Core` deployment path. The current
deployment model is:

- `systemd` units inside WSL
- `openclaw-host-stack.target` for steady-state prod bridge and recovery
- `openclaw-host-bridge-stage.service` as the on-demand stage bridge
- the Windows bootstrap artifact rendered from `platform-engineering`

Use the files in this directory only when you intentionally need the old tmux
session fallback:

- `start-openclaw-host-bridge-tmux.sh`
- `start-openclaw-host-recovery-tmux.sh`
- `start-openclaw-host-stack-tmux.sh`
- `stop-openclaw-host-stack.sh`

Operators browsing the repo should start with:

- `../status-openclaw-host-stack.sh`
- `../../docs/host-deployment.md`
- `../../docs/install.md`
- `../../docs/wsl-mode.md`
