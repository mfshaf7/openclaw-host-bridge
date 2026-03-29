# Host-Control Capability Matrix

This table tracks the operator-facing host-control capabilities that currently
matter in the Telegram-bound setup.

It is not meant to replace API reference docs. It is meant to keep future work
grounded in current state, verification level, and next action.

## Immediate Read-Only Capabilities

| Capability | Example request | Current state | Verification level | Next update |
| --- | --- | --- | --- | --- |
| Show drives | `show drives` | Working | Previously used live; not re-verified in latest pass | Add to post-reboot verification checklist |
| Show allowed roots | `show allowed roots` | Working | Parser/runtime path exists | Add a regression test for topic-bound routing |
| Health check | `health check` | Working | Existing direct-read path | Fold into broader operator summary later |
| Host status / diagnostics | `host status` | Working | Live diagnostics endpoint verified | Extend to include repair history and gateway callback status |
| Browse absolute path or drive | `browse c` | Working | Existing direct-read path | Add checklist row for one live browse validation |
| Browse named folder | `browse downloads` | Working | Existing direct-read path | Improve disambiguation/reporting for multiple matches |
| Find file or folder | `find project notes` | Working | Existing direct-read path | Add a few live regression examples to docs |

## Confirmation-Required Capabilities

| Capability | Example request | Current state | Verification level | Next update |
| --- | --- | --- | --- | --- |
| Send file to Telegram | `send no 1` | Implemented | Not re-verified in current maintenance pass | Add one live verification item |
| Rename path | `rename no 3 to archive.txt` | Implemented | Not re-verified in current pass | Add audit trail before further expansion |
| Move path(s) | `move no 2 to downloads` | Implemented | Not re-verified in current pass | Add audit trail and better result summaries |
| Quarantine path(s) | `quarantine no 4` | Implemented | Not re-verified in current pass | Verify quarantine destination visibility |
| Create folder | `create folder reports in downloads` | Implemented | Not re-verified in current pass | Add audit logging |
| Add allowed root | `add downloads to allowed roots` | Implemented | Not re-verified in current pass | Add explicit admin audit logging |
| Remove allowed root | `remove no 2` | Implemented | Previously exercised indirectly | Add explicit confirmation and audit trail review |
| Monitor power | `turn off monitor` | Implemented | Not re-verified in current pass | Verify behavior after reboot/logon persistence changes |
| Self-heal / repair | `self heal` | Working | Live forced-failure recovery verified | Add repair history and clearer status classes |

## Host-Control Adjacent Capability

| Capability | Example request | Current state | Verification level | Next update |
| --- | --- | --- | --- | --- |
| Forced desktop screenshot delivery | `send desktop screenshot` | Working | Existing direct path; not re-verified in latest pass | Add one live verification and include in operator checklist |

## Tracking Notes

- `Working` means the capability is behaving correctly in the current setup.
- `Implemented` means the code path exists, but it was not explicitly re-verified
  during the latest self-heal maintenance window.
- Update this matrix whenever a capability is re-verified, changed, or found to
  have a regression.
