#!/usr/bin/env bash
set -euo pipefail

PAYLOAD_PATH="${1:-}"
if [[ -z "$PAYLOAD_PATH" ]]; then
  echo '{"ok":false,"error":{"code":"invalid_argument","message":"missing payload path"}}'
  exit 1
fi

ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-/home/mfshaf7/projects/openclaw-host-bridge}"
NODE_BIN_DIR="${OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR:-/home/mfshaf7/.nvm/versions/node/v24.14.1/bin}"
CONFIG_PATH="${OPENCLAW_HOST_BRIDGE_CONFIG:-$ROOT/config/policy.local.json}"
CONFIG_JSON_PATH="${OPENCLAW_CONFIG_PATH:-/home/mfshaf7/.openclaw/openclaw.json}"
GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
if [[ -z "$GATEWAY_TOKEN" && -f "$CONFIG_JSON_PATH" ]]; then
  GATEWAY_TOKEN="$("$NODE_BIN_DIR/node" -e 'const fs=require("fs"); const cfg=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(cfg.gateway.auth.token);' "$CONFIG_JSON_PATH")"
fi
INTEROP="$(ls -1t /run/WSL/*_interop 2>/dev/null | head -n1 || true)"

exec env -i \
  HOME=/root \
  LANG=C.UTF-8 \
  LOGNAME=root \
  OPENCLAW_GATEWAY_TOKEN="$GATEWAY_TOKEN" \
  OPENCLAW_HOST_BRIDGE_CONFIG="$CONFIG_PATH" \
  OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR="$NODE_BIN_DIR" \
  OPENCLAW_HOST_BRIDGE_ROOT="$ROOT" \
  OPENCLAW_HOST_BRIDGE_ISOLATION_DEPTH=2 \
  OPENCLAW_CONFIG_PATH="$CONFIG_JSON_PATH" \
  PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin" \
  SHELL=/usr/bin/bash \
  USER=root \
  WSL_INTEROP="$INTEROP" \
  "$NODE_BIN_DIR/node" "$ROOT/scripts/run_bridge_operation.mjs" "$PAYLOAD_PATH"
