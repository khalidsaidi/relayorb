#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

TF_DIR="${TF_DIR:-$ROOT_DIR/infra/gcp/terraform/envs/demo}"
if [[ "$TF_DIR" != /* ]]; then
  TF_DIR="$ROOT_DIR/$TF_DIR"
fi

TF_VARS_FILE="${TF_VARS_FILE:-$TF_DIR/terraform.tfvars}"
if [[ "$TF_VARS_FILE" != /* ]]; then
  TF_VARS_FILE="$ROOT_DIR/$TF_VARS_FILE"
fi

TF_BACKEND_BUCKET="${TF_BACKEND_BUCKET:-}"
TF_BACKEND_PREFIX="${TF_BACKEND_PREFIX:-relayorb/demo-ephemeral-$(date +%s)}"
KEEP_RESOURCES="${KEEP_RESOURCES:-0}"
CHECK_RATE_LIMIT="${CHECK_RATE_LIMIT:-0}"

INIT_DONE=0

log() {
  echo "[ephemeral-demo-proof] $*"
}

warn() {
  echo "[ephemeral-demo-proof] WARN: $*" >&2
}

fail() {
  echo "[ephemeral-demo-proof] FAIL: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

for cmd in terraform curl jq bash; do
  require_cmd "$cmd"
done

[ -d "$TF_DIR" ] || fail "terraform directory not found: $TF_DIR"
[ -f "$TF_VARS_FILE" ] || fail "terraform vars file not found: $TF_VARS_FILE"

cleanup() {
  if [ "$KEEP_RESOURCES" = "1" ]; then
    log "KEEP_RESOURCES=1; skipping terraform destroy"
    return 0
  fi

  if [ "$INIT_DONE" != "1" ]; then
    return 0
  fi

  log "destroying ephemeral demo stack"
  set +e
  terraform -chdir="$TF_DIR" destroy -auto-approve -input=false -var-file="$TF_VARS_FILE"
  local rc=$?
  set -e

  if [ "$rc" -ne 0 ]; then
    warn "terraform destroy failed (exit=$rc)"
    warn "manual cleanup: terraform -chdir=\"$TF_DIR\" destroy -auto-approve -input=false -var-file=\"$TF_VARS_FILE\""
  else
    log "ephemeral resources destroyed"
  fi
}

trap cleanup EXIT INT TERM

log "terraform init in $TF_DIR"
init_args=(-input=false -reconfigure)
if [ -n "$TF_BACKEND_BUCKET" ]; then
  init_args+=(
    "-backend-config=bucket=$TF_BACKEND_BUCKET"
    "-backend-config=prefix=$TF_BACKEND_PREFIX"
  )
  log "using remote backend: bucket=$TF_BACKEND_BUCKET prefix=$TF_BACKEND_PREFIX"
else
  warn "TF_BACKEND_BUCKET not set; using backend config from local terraform files"
fi

terraform -chdir="$TF_DIR" init "${init_args[@]}"
INIT_DONE=1

log "terraform apply"
terraform -chdir="$TF_DIR" apply -auto-approve -input=false -var-file="$TF_VARS_FILE"

DEMO_URL="$(terraform -chdir="$TF_DIR" output -raw demo_https_url 2>/dev/null || true)"
if [ -z "$DEMO_URL" ]; then
  DEMO_URL="$(terraform -chdir="$TF_DIR" output -raw demo_http_url)"
fi
REGISTRY_URL="$(terraform -chdir="$TF_DIR" output -raw registry_service_url)"
WORKER_URL="$(terraform -chdir="$TF_DIR" output -raw worker_service_url)"

log "running demo smoke suite"
if [ "$CHECK_RATE_LIMIT" = "1" ]; then
  RELAYORB_DEMO_REQUIRE_RATE_LIMIT=1 \
    bash "$ROOT_DIR/ops/smoke/demo-anon-smoke.sh" "$DEMO_URL" "$REGISTRY_URL" "$WORKER_URL"
else
  bash "$ROOT_DIR/ops/smoke/demo-anon-smoke.sh" "$DEMO_URL" "$REGISTRY_URL" "$WORKER_URL"
fi

log "PASS: ephemeral demo proof completed"
if [ "$KEEP_RESOURCES" = "1" ]; then
  log "resources retained intentionally"
  log "manual cleanup command:"
  log "terraform -chdir=\"$TF_DIR\" destroy -auto-approve -input=false -var-file=\"$TF_VARS_FILE\""
fi
