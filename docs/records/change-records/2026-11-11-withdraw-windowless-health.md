---
security_evidence:
  review_areas: [runtime]
  findings: []
  risks: []
  workstreams: [WS-006]
---

# Withdraw the windowless health launcher

## Summary

- Date: 2026-11-11
- Short title: Withdraw the unqualified launcher and retain the original startup path
- Environment: Existing local Windows/WSL installation
- Severity: High
- Classification: operator-authorized maintenance rollback outside ART
- Landing Unit Decision: `feature_single_landing_unit`, `withdraw-windows-health-launcher-20261111`

## Classification

Withdraw PR18's launcher after endpoint protection terminated the live deployment
process. The user selected the simpler Windows Console Host configuration rather
than pursuing the new hidden launcher. No antivirus exclusion is authorized.

## Ownership

Host Bridge owns source withdrawal and installation guidance; Security owns the
superseding review and generated index. Console feature work remains paused.

## Root Cause

Kaspersky reported `PDM:Trojan.Win32.Generic` for the operator-private deployment
script. Its reported MD5 matched the generated script exactly. It stopped a
process, changed Startup and attempted hidden execution. Those actions are a
plausible behavioural trigger; the exact detection rule and false-positive
status are unverified. The operator also reported a Startup-folder detection
without the exact filename. The original installed monitor's hash is unchanged.

## Source Changes

Restore the original CMD launcher, remove the new JScript helper and replace its
installation guidance with the original path and explicit endpoint-protection
hold. Retain the historical record with a withdrawal notice. No detection is
bypassed and no new execution host, hidden runner or service is introduced.

## Artifact And Deployment Evidence

Private evidence retains the alert, hash comparison, unchanged monitor and
rollback backups. Previous launcher bytes were restored. Both health Startup
entries were disabled after the second alert; neither blocked script was rerun.
The user-level default-console preference was restored to Windows Console Host
using Microsoft's documented values; Windows Terminal remains directly usable.

## Live Verification

Readback confirms the classic-host preference, original monitor hash and disabled
health entries. Endpoint protection remains enabled with no added exclusions.
The Console remains reachable. A subsequent exact-process check found one
original monitor running and writing fresh snapshots; no duplicate was started.
Disabling a Startup entry had not established that its process was stopped.
Automatic health startup remains unverified. This record does not claim a false
positive, absence of malware or permission to recreate an antivirus-deleted entry.

## Follow-Up

Leave the blocked health startup entry paused until the precise object and its
security disposition are verified. Retain evidence and use vendor review when
required; do not repackage or retry the blocked deployment to evade detection.
Complete owner checks, source review, dependent Security update and cleanup.
