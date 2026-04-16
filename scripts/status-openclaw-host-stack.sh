#!/usr/bin/env bash
set -euo pipefail

BRIDGE_SESSION="${OPENCLAW_HOST_BRIDGE_TMUX_SESSION:-openclaw-host-bridge}"
RECOVERY_SESSION="${OPENCLAW_HOST_RECOVERY_TMUX_SESSION:-openclaw-host-recovery}"
ROOT="${OPENCLAW_HOST_BRIDGE_ROOT:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)}"
BRIDGE_UNIT="openclaw-host-bridge.service"
RECOVERY_UNIT="openclaw-host-recovery.service"
BRIDGE_URL="${OPENCLAW_HOST_BRIDGE_HEALTH_URL:-http://127.0.0.1:48721/healthz}"

print_unit_status() {
  local unit="$1"
  local label="$2"

  if systemctl --quiet is-active "$unit" 2>/dev/null; then
    echo "  $label: active ($unit)"
  elif systemctl --quiet is-failed "$unit" 2>/dev/null; then
    echo "  $label: failed ($unit)"
  elif systemctl --quiet show "$unit" >/dev/null 2>&1; then
    echo "  $label: inactive ($unit)"
  else
    echo "  $label: unknown (systemd status unavailable from this shell)"
  fi
}

print_bridge_attestation() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi

  local main_pid fragment_path working_directory exec_start
  main_pid="$(systemctl show -p MainPID --value "$BRIDGE_UNIT" 2>/dev/null || true)"
  fragment_path="$(systemctl show -p FragmentPath --value "$BRIDGE_UNIT" 2>/dev/null || true)"
  working_directory="$(systemctl show -p WorkingDirectory --value "$BRIDGE_UNIT" 2>/dev/null || true)"
  exec_start="$(systemctl show -p ExecStart --value "$BRIDGE_UNIT" 2>/dev/null || true)"

  echo
  echo "bridge runtime:"
  printf "  unit file : %s\n" "${fragment_path:-unknown}"
  printf "  workdir   : %s\n" "${working_directory:-unknown}"
  printf "  execstart : %s\n" "${exec_start:-unknown}"

  if [[ -n "$main_pid" && "$main_pid" != "0" ]]; then
    printf "  main pid  : %s\n" "$main_pid"
    ps -o etimes=,cmd= -p "$main_pid" 2>/dev/null | while read -r etimes cmd; do
      printf "  uptime s  : %s\n" "${etimes:-unknown}"
      printf "  command   : %s\n" "${cmd:-unknown}"
    done
  else
    printf "  main pid  : %s\n" "not running"
  fi
}

print_bridge_health() {
  local payload
  payload="$(curl -fsS "$BRIDGE_URL" 2>/dev/null || true)"

  echo
  echo "bridge health:"
  if [[ -z "$payload" ]]; then
    printf "  url       : %s\n" "$BRIDGE_URL"
    echo "  result    : unavailable"
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json
import sys

payload = json.loads(sys.argv[1])
runtime = payload.get("runtime") or {}
listener = payload.get("listener") or {}
print("  url       :", sys.argv[2])
print("  ok        :", payload.get("ok"))
print("  mode      :", payload.get("mode", "unknown"))
print("  listener  :", str(listener.get("host", "unknown")) + ":" + str(listener.get("port", "unknown")))
print("  source    :", runtime.get("source", "unknown"))
print("  root      :", runtime.get("rootPath", "unknown"))
print("  config    :", runtime.get("configPath", "unknown"))
print("  env file  :", runtime.get("envFilePath", "unknown"))
print("  git commit:", runtime.get("gitCommit", "unknown"))
print("  version   :", runtime.get("packageVersion", "unknown"))
print("  pid       :", runtime.get("pid", "unknown"))
print("  started   :", runtime.get("startedAt", "unknown"))
print("  uptime s  :", runtime.get("uptimeSeconds", "unknown"))
' "$payload" "$BRIDGE_URL"
    return 0
  fi

  printf "  url       : %s\n" "$BRIDGE_URL"
  echo "  result    : $payload"
}

if command -v systemctl >/dev/null 2>&1; then
  echo "systemd units:"
  if systemctl --quiet is-active openclaw-host-stack.target 2>/dev/null; then
    echo "  stack   : active (openclaw-host-stack.target)"
  elif systemctl --quiet is-failed openclaw-host-stack.target 2>/dev/null; then
    echo "  stack   : failed (openclaw-host-stack.target)"
  elif systemctl --quiet show openclaw-host-stack.target >/dev/null 2>&1; then
    echo "  stack   : inactive (openclaw-host-stack.target)"
  else
    echo "  stack   : unknown (systemd status unavailable from this shell)"
  fi
  print_unit_status "$BRIDGE_UNIT" "bridge  "
  print_unit_status "$RECOVERY_UNIT" "recovery"
fi

echo
echo "tmux sessions (legacy fallback):"
tmux has-session -t "$BRIDGE_SESSION" 2>/dev/null && echo "  bridge  : running ($BRIDGE_SESSION)" || echo "  bridge  : stopped ($BRIDGE_SESSION)"
tmux has-session -t "$RECOVERY_SESSION" 2>/dev/null && echo "  recovery: running ($RECOVERY_SESSION)" || echo "  recovery: stopped ($RECOVERY_SESSION)"

if command -v ss >/dev/null 2>&1; then
  echo
  echo "listeners:"
  ss -ltn "( sport = :48721 or sport = :48722 )" || true
fi

echo
echo "pid files:"
for path in \
  "$ROOT/tmp/openclaw-host-bridge.pid" \
  "$ROOT/tmp/openclaw-host-recovery.pid"
do
  if [[ -f "$path" ]]; then
    printf "  %s -> %s\n" "$path" "$(cat "$path" 2>/dev/null || true)"
  else
    printf "  %s -> (missing)\n" "$path"
  fi
done

print_bridge_attestation
print_bridge_health
