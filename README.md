# pc-control-bridge

`pc-control-bridge` is a host-side bridge for OpenClaw `pc-control`.

It is designed for users who run OpenClaw in an isolated container or VM but still want controlled access to their actual Windows host for:

- file listing
- file search
- metadata inspection
- folder organization
- staged file export
- limited browser-aware workflows

## Publishable v1

The supported v1 mode is:

- Windows host
- WSL2-backed bridge runtime
- isolated OpenClaw runtime
- OpenClaw plugin + skill on the OpenClaw side

This is not a core OpenClaw patch. It is an extension pattern.

## Docs

- [Architecture](docs/architecture.md)
- [WSL Mode](docs/wsl-mode.md)
- [Install Guide](docs/install.md)
- [Security Model](docs/security-model.md)
- [Known Limitations](docs/limitations.md)

## Status

Current maturity:

- read-only host access: working
- organize actions: working
- export flow: not complete
- browser inspection: not complete
- Windows silent persistence: environment-sensitive, document as beta
