# Security Model

## Design Principles

- OpenClaw stays isolated
- host access is explicit
- the bridge is the host enforcement point
- read-only actions should be easy to use
- higher-risk actions should require stronger intent

## Permission Classes

The bridge separates operations into explicit classes:

- `read`
- `organize`
- `export`
- `browser_inspect`
- `admin_high_risk`

This separation prevents one “host access” switch from granting everything.

## Path Policy

The bridge should operate on allowlisted roots only.

Typical allowed roots are:

- Desktop
- Documents
- Downloads
- Music

Avoid broad system roots by default.

## Organize Actions

Mutating file operations should require all of the following:

- bridge organize permission enabled
- OpenClaw-side write mode enabled
- explicit confirmation on the requesting side

## Export Actions

Export should stay separate from ordinary file organization.

Why:

- organization changes host state
- export moves host data across a delivery boundary

Those are not the same risk class.

## Browser Actions

Browser tab listing can be lower risk than deep inspection.

Keep deep inspection disabled by default unless there is a real need for it.

## Admin-High-Risk Actions

These are actions such as:

- changing allowed roots
- host discovery outside current allowed roots
- monitor power control

They should be treated more carefully than ordinary read-only requests.

## Audit

The bridge should always be able to answer:

- who requested the action
- which operation ran
- what arguments were used
- whether it succeeded

That is why audit belongs to the bridge instead of to the channel layer alone.

## Health Model

Bridge health should not report the gateway as degraded just because the
gateway is not reachable on WSL loopback.

In host-side bridge deployments where OpenClaw runs remotely in k3s, a VM, or a
separate container boundary, gateway health is optional unless the operator
explicitly configures `OPENCLAW_GATEWAY_HEALTH_URL`. Remote gateway reachability
can be observed elsewhere without making the host bridge claim a false local
degradation.

That health surface must still provide runtime attestation. `/healthz` should
identify the live root path, config path, expected environment file, package
version, PID, and Git commit when available so operators can prove which bridge
revision is enforcing host policy.
