# Architecture

## Goal

Keep OpenClaw isolated while allowing controlled access to the real host PC.

## Components

1. `pc-control` skill
- user-facing workflow and operating guidance

2. `pc-control` OpenClaw plugin
- typed tools exposed to OpenClaw
- maps tool calls to bridge operations

3. `pc-control-bridge`
- host-side policy enforcement point
- owns path restrictions, operation restrictions, and audit logging

## Trust boundaries

### OpenClaw runtime

Responsibilities:

- conversation
- orchestration
- approval flow
- tool invocation

Not the trust anchor for host access.

### Host bridge

Responsibilities:

- allowlisted operations only
- allowed roots only
- permission classes
- audit logging

This is the trust anchor for host control.

### Delivery channel

If files are later sent through Telegram or another channel, that is a separate exfiltration boundary and must be treated independently from host organization.

## Recommended capability tiers

### Tier 1

- `health.check`
- `fs.list`
- `fs.search`
- `fs.read_meta`

### Tier 2

- `fs.mkdir`
- `fs.move`

### Tier 3

- `fs.zip_for_export`
- `fs.stage_for_telegram`
- `browser.tabs.inspect`

## Publishable v1 choice

For v1, the documented deployment mode is:

- Windows host
- WSL-backed bridge runtime

That mode is publishable because it is explicit, documented, and does not depend on OpenClaw core drift.
