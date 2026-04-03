#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
DEFAULT_CONFIG_PATH="$ROOT/config/policy.local.json"
OPENCLAW_HOME_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}"
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
PID_PATH="${OPENCLAW_HOST_BRIDGE_PID_PATH:-$ROOT/tmp/openclaw-host-bridge.pid}"
LOCK_PATH="${OPENCLAW_HOST_BRIDGE_LOCK_PATH:-$ROOT/tmp/openclaw-host-bridge.lock}"
LOG_PATH="${OPENCLAW_HOST_BRIDGE_LOG_PATH:-$ROOT/tmp/openclaw-host-bridge.log}"
NODE_BIN_DIR="${OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR:-}"

resolve_node_bin_dir() {
  if [[ -n "$NODE_BIN_DIR" && -x "$NODE_BIN_DIR/node" ]]; then
    printf '%s\n' "$NODE_BIN_DIR"
    return 0
  fi

  local candidate
  for candidate in \
    "$HOME/.nvm/versions/node/current/bin" \
    "$HOME/.nvm/versions/node"/*/bin
  do
    if [[ -x "$candidate/node" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  printf '%s\n' ""
}

pid_matches_bridge() {
  local pid="$1"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  local cmdline
  cmdline="$(tr '\0' ' ' </proc/"$pid"/cmdline 2>/dev/null || true)"
  [[ "$cmdline" == *"$ROOT/src/index.mjs"* ]]
}

NODE_BIN_DIR="$(resolve_node_bin_dir)"
export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

mkdir -p "$ROOT/tmp"

exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "openclaw-host-bridge startup already in progress"
  exit 0
fi

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  if pid_matches_bridge "${existing_pid:-}"; then
    echo "openclaw-host-bridge already running with pid $existing_pid"
    exit 0
  fi
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :48721" | grep -q ':48721'; then
  echo "openclaw-host-bridge port 48721 already listening"
  exit 0
fi

gateway_token="$(
  node -e 'const fs=require("fs"); const os=require("os"); const path=require("path"); const cfg=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH || path.join(process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw"), "openclaw.json"),"utf8")); process.stdout.write(cfg.gateway.auth.token)'
)"

export OPENCLAW_HOST_BRIDGE_ROOT="$ROOT"
export OPENCLAW_CONFIG_PATH="$OPENCLAW_CONFIG_PATH_VALUE"
export OPENCLAW_GATEWAY_TOKEN="$gateway_token"
export OPENCLAW_HOST_BRIDGE_CONFIG="$CONFIG_PATH"

echo "$$" >"$PID_PATH"
exec node "$ROOT/src/index.mjs" >>"$LOG_PATH" 2>&1
