#!/usr/bin/env bash
set -euo pipefail

BRIDGE_SESSION="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
RECOVERY_SESSION="${OPENCLAW_HOST_RECOVERY_TMUX_SESSION:-openclaw-host-recovery}"

tmux kill-session -t "$BRIDGE_SESSION" 2>/dev/null || true
tmux kill-session -t "$RECOVERY_SESSION" 2>/dev/null || true

echo "stopped host stack:"
echo "  bridge session  : $BRIDGE_SESSION"
echo "  recovery session: $RECOVERY_SESSION"
