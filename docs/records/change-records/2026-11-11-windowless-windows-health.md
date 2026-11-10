---
security_evidence:
  review_areas: [runtime]
  findings: []
  risks: []
  workstreams: [WS-006]
---

# Windowless Windows health monitoring

## Summary

- Date: 2026-11-11
- Short title: Keep the existing Windows health monitor outside visible terminals
- Environment: Local Windows/WSL interactive-user installation
- Severity: Low
- Classification: operator-approved owner maintenance outside the shared runtime ART
- Landing Unit Decision: `feature_single_landing_unit`, `windows-health-launcher-20261111`

## Classification

Repair the launcher for the existing monitor. The monitor intentionally loops;
the user-visible terminal was an execution-host presentation problem, not an
unfinished platform bootstrap. Do not create an ART item or change monitoring,
recovery, provider or interactive-terminal behavior.

## Ownership

`openclaw-host-bridge` owns the launcher and installation procedure. Security
owns the dependent runtime delta/index. Existing installed health-script
extensions remain outside this narrowly scoped change.

## Root Cause

The Startup `.cmd` waited synchronously for an endless PowerShell monitor and
relied on `-WindowStyle Hidden`. Windows Terminal delegation can expose that
console. Native gateway diagnostic stderr then appeared in the user window.

## Source Changes

Use the existing GUI Windows Script Host with creation-time hidden startup, a
detached manual-launch path and a Startup shortcut with no parent command window. Preserve
the same user, script, interval and runtime directory. Append stdout/stderr to
private runtime logs; keep the existing snapshot and health log. Launcher errors
also retain a separate diagnostic log. No new root,
network, task-registration or environment authority is added.

## Artifact And Deployment Evidence

Gary source publication, delegated exact-head review and owner validation precede
installation of only the accepted launcher. Preserve the installed monitor's
exact bytes and existing launcher/Startup entry as private rollback evidence.

## Live Verification

Exercise the actual Windows launcher in an isolated directory containing spaces,
including detached return and stdout/stderr capture. Then qualify the real
Startup shortcut: exactly one monitor, no visible monitor window, two fresh
snapshot writes and unchanged installed script. Controlled qualification artifacts
remain private; no fake health snapshot is installed as operating truth.

## Follow-Up

Complete dependent Security index/review, native live readback, source-grant
revocation and branch/worktree cleanup before closure. A future reboot remains a
separate logon rehearsal; native shortcut launch is not proof of an actual reboot.
Rollback restores the preserved launcher/Startup entry and stops only the newly
identified monitor, leaving the monitor script and runtime data intact.
