#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${PC_CONTROL_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
RESTART_DELAY_SECONDS="${PC_CONTROL_RESTART_DELAY_SECONDS:-2}"

while true; do
  "$ROOT/scripts/start-pc-control-bridge.sh" || true
  sleep "$RESTART_DELAY_SECONDS"
done
