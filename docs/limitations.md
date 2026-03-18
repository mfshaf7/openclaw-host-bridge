# Known Limitations

## Current v1 limitations

- WSL-backed mode is the documented mode; native Windows service mode is not complete
- browser inspection is not complete
- export/staging flow is not complete
- Windows silent persistence should be treated as beta and validated per environment

## Not included

- OpenClaw core patches
- unrestricted shell access by default
- native ClawHub runtime ownership of the host bridge

## Operational note

This repository is publishable as a v1 pattern because the mode is explicit and documented, but some startup behavior is still environment-sensitive and should be described honestly in release notes.
