#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ] || [ "${3:-}" = "" ] || [ "${4:-}" = "" ]; then
  echo "usage: $0 <gateway_url> <registry_url> <worker_url> <gateway_bearer_token>"
  exit 2
fi

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd"
    exit 2
  fi
done

GATEWAY_URL="${1%/}"
REGISTRY_URL="${2%/}"
WORKER_URL="${3%/}"
GATEWAY_BEARER_TOKEN="$4"
CAPABILITY_ID="${CAPABILITY_ID:-rag.search@v1}"

TMP_DIR="$(mktemp -d /tmp/relayorb-network-posture-smoke.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[network-posture-smoke] $*"
}

curl_status() {
  local body_file="$1"
  shift
  curl -sS -o "$body_file" -w "%{http_code}" "$@"
}

assert_private_health() {
  local label="$1"
  local url="$2"
  local body="$TMP_DIR/${label}-health.txt"
  local code
  code="$(curl_status "$body" "$url/health")"
  if [ "$code" != "403" ]; then
    log "expected ${label} unauthenticated health to return 403, got $code"
    sed -n '1,120p' "$body" || true
    exit 1
  fi
  log "${label} unauthenticated health is private (403)"
}

assert_gateway_invoke() {
  local request_id
  request_id="smoke-$(date +%s)-$RANDOM"
  local body="$TMP_DIR/gateway-invoke.json"
  local response_code
  response_code="$(curl_status "$body" \
    -X POST "$GATEWAY_URL/v1/invoke" \
    -H "content-type: application/json" \
    -H "authorization: Bearer $GATEWAY_BEARER_TOKEN" \
    --data "$(jq -nc \
      --arg requestId "$request_id" \
      --arg capability "$CAPABILITY_ID" \
      '{
        requestId: $requestId,
        caller: {
          agentId: "network-posture-smoke",
          role: "researcher"
        },
        capability: $capability,
        payload: {
          query: "network posture smoke",
          topK: 2
        }
      }'
    )")"

  if [ "$response_code" != "200" ]; then
    log "expected gateway invoke status 200, got $response_code"
    sed -n '1,200p' "$body" || true
    exit 1
  fi

  jq -e --arg req "$request_id" '
    .status == "ok"
    and .requestId == $req
    and (.traceId | type == "string")
    and (.traceId | length > 0)
  ' "$body" >/dev/null || {
    log "gateway invoke envelope missing required request/trace fields"
    sed -n '1,200p' "$body" || true
    exit 1
  }

  local routed_to
  routed_to="$(jq -r '.meta.routedTo // ""' "$body")"
  if [[ -z "$routed_to" || "$routed_to" != "$WORKER_URL"* ]]; then
    log "expected gateway routedTo to start with worker URL ($WORKER_URL), got '$routed_to'"
    sed -n '1,200p' "$body" || true
    exit 1
  fi

  log "gateway invoke e2e succeeded and routed to worker ($routed_to)"
}

assert_private_health "registry" "$REGISTRY_URL"
assert_private_health "worker" "$WORKER_URL"
assert_gateway_invoke
log "network posture smoke checks passed"
