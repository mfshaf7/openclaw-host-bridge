#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
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

export OPENCLAW_HOST_BRIDGE_ROOT="$ROOT"
export OPENCLAW_HOST_BRIDGE_CONFIG="$CONFIG_PATH"
export OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH_VALUE"

"$ROOT/scripts/legacy/start-openclaw-host-bridge-tmux.sh"
"$ROOT/scripts/legacy/start-openclaw-host-recovery-tmux.sh"

echo "started host stack:"
echo "  bridge session  : ${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
echo "  recovery session: ${OPENCLAW_HOST_RECOVERY_TMUX_SESSION:-openclaw-host-recovery}"
echo "  bridge config   : $CONFIG_PATH"
echo "  openclaw config : $OPENCLAW_CONFIG_PATH_VALUE"
