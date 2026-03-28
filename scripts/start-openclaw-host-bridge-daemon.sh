#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
CONFIG_PATH="${OPENCLAW_HOST_BRIDGE_CONFIG:-$ROOT/config/policy.local.json}"
PID_PATH="${OPENCLAW_HOST_BRIDGE_PID_PATH:-$ROOT/tmp/openclaw-host-bridge.pid}"
LOG_PATH="${OPENCLAW_HOST_BRIDGE_LOG_PATH:-$ROOT/tmp/openclaw-host-bridge.log}"
NODE_BIN_DIR="${OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR:-$HOME/.nvm/versions/node/v24.14.0/bin}"

export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

mkdir -p "$ROOT/tmp"

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  if [[ -n "${existing_pid:-}" ]] && kill -0 "$existing_pid" 2>/dev/null; then
    exit 0
  fi
fi

gateway_token="$(
  node -e 'const fs=require("fs"); const os=require("os"); const path=require("path"); const cfg=JSON.parse(fs.readFileSync(process.env.OPENCLAW_CONFIG_PATH || path.join(process.env.OPENCLAW_HOME || path.join(os.homedir(), ".openclaw"), "openclaw.json"),"utf8")); process.stdout.write(cfg.gateway.auth.token)'
)"

(
  export OPENCLAW_GATEWAY_TOKEN="$gateway_token"
  export OPENCLAW_HOST_BRIDGE_CONFIG="$CONFIG_PATH"
  nohup node "$ROOT/src/index.mjs" >>"$LOG_PATH" 2>&1 &
  echo $! >"$PID_PATH"
) >/dev/null 2>&1

sleep 1

started_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
if [[ -z "${started_pid:-}" ]] || ! kill -0 "$started_pid" 2>/dev/null; then
  echo "openclaw-host-bridge failed to start" >&2
  exit 1
fi
