#!/usr/bin/env bash
set -euo pipefail

BRIDGE_SESSION="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
RECOVERY_SESSION="${OPENCLAW_HOST_RECOVERY_TMUX_SESSION:-openclaw-host-recovery}"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"

if command -v systemctl >/dev/null 2>&1; then
  echo "systemd units:"
  if systemctl --quiet is-active openclaw-host-stack.target 2>/dev/null; then
    echo "  stack   : active (openclaw-host-stack.target)"
  elif systemctl --quiet is-failed openclaw-host-stack.target 2>/dev/null; then
    echo "  stack   : failed (openclaw-host-stack.target)"
  elif systemctl --quiet show openclaw-host-stack.target >/dev/null 2>&1; then
    echo "  stack   : inactive (openclaw-host-stack.target)"
  else
    echo "  stack   : unknown (systemd status unavailable from this shell)"
  fi
  if systemctl --quiet is-active openclaw-host-bridge.service 2>/dev/null; then
    echo "  bridge  : active (openclaw-host-bridge.service)"
  elif systemctl --quiet is-failed openclaw-host-bridge.service 2>/dev/null; then
    echo "  bridge  : failed (openclaw-host-bridge.service)"
  elif systemctl --quiet show openclaw-host-bridge.service >/dev/null 2>&1; then
    echo "  bridge  : inactive (openclaw-host-bridge.service)"
  else
    echo "  bridge  : unknown (systemd status unavailable from this shell)"
  fi
  if systemctl --quiet is-active openclaw-host-recovery.service 2>/dev/null; then
    echo "  recovery: active (openclaw-host-recovery.service)"
  elif systemctl --quiet is-failed openclaw-host-recovery.service 2>/dev/null; then
    echo "  recovery: failed (openclaw-host-recovery.service)"
  elif systemctl --quiet show openclaw-host-recovery.service >/dev/null 2>&1; then
    echo "  recovery: inactive (openclaw-host-recovery.service)"
  else
    echo "  recovery: unknown (systemd status unavailable from this shell)"
  fi
fi

echo
echo "tmux sessions (legacy fallback):"
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
