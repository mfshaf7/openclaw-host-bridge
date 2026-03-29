#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
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
PID_PATH="${OPENCLAW_HOST_RECOVERY_PID_PATH:-$ROOT/tmp/openclaw-host-recovery.pid}"
LOCK_PATH="${OPENCLAW_HOST_RECOVERY_LOCK_PATH:-$ROOT/tmp/openclaw-host-recovery.lock}"
LOG_PATH="${OPENCLAW_HOST_RECOVERY_LOG_PATH:-$ROOT/tmp/openclaw-host-recovery.log}"
NODE_BIN_DIR="${OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR:-$HOME/.nvm/versions/node/v24.14.0/bin}"
SERVER="$ROOT/scripts/openclaw-host-recovery-server.mjs"

export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

mkdir -p "$ROOT/tmp"

exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "openclaw-host-recovery startup already in progress"
  exit 0
fi

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  if [[ -n "${existing_pid:-}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "openclaw-host-recovery already running with pid $existing_pid"
    exit 0
  fi
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :48722" | grep -q ':48722'; then
  echo "openclaw-host-recovery port 48722 already listening"
  exit 0
fi

export OPENCLAW_HOST_BRIDGE_ROOT="$ROOT"
export OPENCLAW_HOST_BRIDGE_CONFIG="$CONFIG_PATH"
export OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH_VALUE"

echo "$$" >"$PID_PATH"
exec node "$SERVER" >>"$LOG_PATH" 2>&1
