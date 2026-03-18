# Security Model

## Design principles

- OpenClaw stays isolated
- host access is explicit
- the bridge is the enforcement point
- read-only should be low-friction
- higher-risk actions require stronger intent

## Permission classes

- `read`
- `organize`
- `export`
- `browser_inspect`
- `admin_high_risk`

## Path policy

Use allowlisted roots only.

Typical roots:

- Desktop
- Documents
- Downloads

Do not allow broad system roots by default.

## Mutating operations

Mutating operations should require:

- bridge organize permission enabled
- plugin write mode enabled
- explicit `confirm: true` on the tool call

## Export operations

Export should remain disabled by default and treated separately from organize actions.

## Browser operations

Browser tab listing can be lower-risk than full inspection. Keep deep inspection disabled by default.
