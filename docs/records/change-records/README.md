# Change Records

This directory stores short evidence records for security-significant or
production-impacting source changes in `openclaw-host-bridge`.

These are not design ADRs and not full incident diaries. They are structured
completion records that answer:

- what changed
- why it mattered at the host trust boundary
- which repo owned the fix
- what validation or live evidence proved the outcome
- which security workstream or review area the change belonged to

When a change should feed `security-architecture` automation, include optional
`security_evidence` YAML front matter. The generated
`security-change-record-index.yaml` in `security-architecture` consumes that
metadata directly.

Start from [TEMPLATE.md](TEMPLATE.md).

For pull-request shaped bridge changes that hit the host-control trust
boundary, run:

```bash
python3 scripts/validate_change_record_requirement.py --repo-root . --against-ref origin/main
```
