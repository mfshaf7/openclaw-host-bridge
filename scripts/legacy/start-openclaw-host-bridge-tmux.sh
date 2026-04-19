#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
SESSION_NAME="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
SUPERVISOR="$ROOT/scripts/run-openclaw-host-bridge-supervisor.sh"
OPENCLAW_HOME_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}"
DEFAULT_CONFIG_PATH="$ROOT/config/policy.local.json"
FALLBACK_CONFIG_PATH="$OPENCLAW_HOME_DIR/workspace-telegram-fast/policy.local.json"
CONFIG_PATH="${OPENCLAW_HOST_BRIDGE_CONFIG:-}"
if [[ -z "$CONFIG_PATH" ]]; then
  if [[ -f "$DEFAULT_CONFIG_PATH" ]]; then
    CONFIG_PATH="$DEFAULT_CONFIG_PATH"
  else
    CONFIG_PATH="$FALLBACK_CONFIG_PATH"
  fi
fi
OPENCLAW_CONFIG_PATH_VALUE="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_HOME_DIR/openclaw.json}"

if ! command -v tmux >/dev/null 2>&1; then
  echo "tmux is required for the legacy manual fallback WSL host mode" >&2
  exit 1
fi

if [[ ! -x "$SUPERVISOR" ]]; then
  chmod +x "$SUPERVISOR"
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "tmux session already running: $SESSION_NAME"
  exit 0
fi

tmux new-session -d -s "$SESSION_NAME" \
  "/bin/bash -lc 'export OPENCLAW_HOST_BRIDGE_ROOT=\"$ROOT\"; export OPENCLAW_HOST_BRIDGE_CONFIG=\"$CONFIG_PATH\"; export OPENCLAW_CONFIG_PATH=\"$OPENCLAW_CONFIG_PATH_VALUE\"; export OPENCLAW_HOST_BRIDGE_TMUX_SESSION=\"$SESSION_NAME\"; \"$SUPERVISOR\"'"
echo "started tmux session: $SESSION_NAME"
