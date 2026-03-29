#!/usr/bin/env bash
set -euo pipefail

BRIDGE_SESSION="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
RECOVERY_SESSION="${OPENCLAW_HOST_RECOVERY_TMUX_SESSION:-openclaw-host-recovery}"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"

echo "tmux sessions:"
tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null && echo "  bridge  : running ($BRIDGE_SESSION)" || echo "  bridge  : stopped ($BRIDGE_SESSION)"
tmux has-session -t "$RECOVERY_SESSION" 2>/dev/null && echo "  recovery: running ($RECOVERY_SESSION)" || echo "  recovery: stopped ($RECOVERY_SESSION)"

if command -v ss >/dev/null 2>&1; then
  echo
  echo "listeners:"
  ss -ltn "( sport = :48721 or sport = :48722 )" || true
fi

echo
echo "pid files:"
for path in \
  "$ROOT/tmp/openclaw-host-bridge.pid" \
  "$ROOT/tmp/openclaw-host-recovery.pid"
do
  if [[ -f "$path" ]]; then
    printf "  %s -> %s\n" "$path" "$(cat "$path" 2>/dev/null || true)"
  else
    printf "  %s -> (missing)\n" "$path"
  fi
done
