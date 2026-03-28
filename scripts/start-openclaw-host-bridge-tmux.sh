#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
SESSION_NAME="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
SUPERVISOR="$ROOT/scripts/run-openclaw-host-bridge-supervisor.sh"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required for the supported persistent WSL host mode" >&2
  exit 1
fi

if [[ ! -x "$SUPERVISOR" ]]; then
  chmod +x "$SUPERVISOR"
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "tmux session already running: $SESSION_NAME"
  exit 0
fi

tmux new-session -d -s "$SESSION_NAME" "/bin/bash -lc '$SUPERVISOR'"
echo "started tmux session: $SESSION_NAME"
