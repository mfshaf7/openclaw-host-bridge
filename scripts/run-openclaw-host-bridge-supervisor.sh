#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
RESTART_DELAY_SECONDS="${OPENCLAW_HOST_BRIDGE_RESTART_DELAY_SECONDS:-2}"

while true; do
  "$ROOT/scripts/start-openclaw-host-bridge.sh" || true
  sleep "$RESTART_DELAY_SECONDS"
done
