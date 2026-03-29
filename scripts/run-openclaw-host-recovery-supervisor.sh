#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$SCRIPT_DIR/.." && pwd)}"
RESTART_DELAY_SECONDS="${OPENCLAW_HOST_RECOVERY_RESTART_DELAY_SECONDS:-2}"
STARTER="$ROOT/scripts/start-openclaw-host-recovery.sh"

while true; do
  "$STARTER" || true
  sleep "$RESTART_DELAY_SECONDS"
done
