#!/usr/bin/env bash
set -euo pipefail

ROOT="${PC_CONTROL_ROOT:-/home/mfshaf7/projects/openclaw-isolated-deployment}"
CONFIG_PATH="${PC_CONTROL_BRIDGE_CONFIG:-$ROOT/pc-control-bridge/config/policy.local.json}"
PID_PATH="$ROOT/tmp/pc-control-bridge.pid"
LOCK_PATH="$ROOT/tmp/pc-control-bridge.lock"
LOG_PATH="$ROOT/tmp/pc-control-bridge.log"
NODE_BIN_DIR="${PC_CONTROL_NODE_BIN_DIR:-$HOME/.nvm/versions/node/v24.14.0/bin}"

export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

mkdir -p "$ROOT/tmp"

exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "pc-control-bridge startup already in progress"
  exit 0
fi

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  if [[ -n "${existing_pid:-}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    echo "pc-control-bridge already running with pid $existing_pid"
    exit 0
  fi
fi

if command -v ss >/dev/null 2>&1 && ss -ltn "sport = :48721" | grep -q ':48721'; then
  echo "pc-control-bridge port 48721 already listening"
  exit 0
fi

gateway_token="$(
  node -e 'const fs=require("fs"); const os=require("os"); const path=require("path"); const cfg=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH || path.join(process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw"), "openclaw.json"),"utf8")); process.stdout.write(cfg.gateway.auth.token)'
)"

export OPENCLAW_GATEWAY_TOKEN="$gateway_token"
export PC_CONTROL_BRIDGE_CONFIG="$CONFIG_PATH"

echo "$$" >"$PID_PATH"
exec node "$ROOT/pc-control-bridge/src/index.mjs" >>"$LOG_PATH" 2>&1
