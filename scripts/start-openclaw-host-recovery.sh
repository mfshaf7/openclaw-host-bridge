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
NODE_BIN_DIR="${OPENCLAW_HOST_BRIDGE_NODE_BIN_DIR:-}"
SERVER="$ROOT/scripts/openclaw-host-recovery-server.mjs"

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

pid_matches_server() {
  local pid="$1"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  local cmdline
  cmdline="$(tr '\0' ' ' </proc/"$pid"/cmdline 2>/dev/null || true)"
  [[ "$cmdline" == *"$SERVER"* ]]
}

NODE_BIN_DIR="$(resolve_node_bin_dir)"
export PATH="$NODE_BIN_DIR:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

mkdir -p "$ROOT/tmp"

KUBECTL_BIN="${OPENCLAW_HOST_RECOVERY_KUBECTL_BIN:-/usr/local/bin/k3s kubectl}"
KUBECONFIG_PATH="${OPENCLAW_HOST_RECOVERY_KUBECONFIG_PATH:-/etc/rancher/k3s/k3s.yaml}"
ARGOCD_NAMESPACE="${OPENCLAW_HOST_RECOVERY_ARGOCD_NAMESPACE:-argocd}"
ARGOCD_REPO_SERVER_SELECTOR="${OPENCLAW_HOST_RECOVERY_ARGOCD_REPO_SERVER_SELECTOR:-app.kubernetes.io/name=argocd-repo-server}"

kube() {
  KUBECONFIG="$KUBECONFIG_PATH" bash -lc "$KUBECTL_BIN $*"
}

repair_argocd_repo_server_if_stuck() {
  local pod_name init_waiting_reason log_output

  pod_name="$(kube "-n $ARGOCD_NAMESPACE get pods -l $ARGOCD_REPO_SERVER_SELECTOR -o jsonpath='{.items[0].metadata.name}'" 2>/dev/null | tr -d "'")"
  if [[ -z "$pod_name" ]]; then
    return 0
  fi

  init_waiting_reason="$(kube "-n $ARGOCD_NAMESPACE get pod $pod_name -o jsonpath='{.status.initContainerStatuses[0].state.waiting.reason}'" 2>/dev/null | tr -d "'")"
  if [[ "$init_waiting_reason" != "CrashLoopBackOff" ]]; then
    return 0
  fi

  log_output="$(kube "-n $ARGOCD_NAMESPACE logs $pod_name -c copyutil --previous" 2>/dev/null || true)"
  if [[ "$log_output" != *"Already exists"* ]]; then
    return 0
  fi

  echo "repairing stuck argocd repo-server pod: $pod_name"
  kube "-n $ARGOCD_NAMESPACE delete pod $pod_name" >/dev/null
}

repair_argocd_repo_server_if_stuck

exec 9>"$LOCK_PATH"
if ! flock -n 9; then
  echo "openclaw-host-recovery startup already in progress"
  exit 0
fi

if [[ -f "$PID_PATH" ]]; then
  existing_pid="$(cat "$PID_PATH" 2>/dev/null || true)"
  if pid_matches_server "${existing_pid:-}"; then
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
