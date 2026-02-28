#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ] || [ "${3:-}" = "" ]; then
  echo "usage: $0 <demo_base_url> <registry_run_url> <worker_run_url>"
  exit 2
fi

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 2
  fi
done

DEMO_URL="${1%/}"
REGISTRY_URL="${2%/}"
WORKER_URL="${3%/}"
REQUIRE_RATE_LIMIT="${RELAYORB_DEMO_REQUIRE_RATE_LIMIT:-0}"

TMP_DIR="$(mktemp -d /tmp/relayorb-demo-smoke.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[demo-anon-smoke] $*"
}

curl_status() {
  local body_file="$1"
  shift
  curl -sS -o "$body_file" -w "%{http_code}" "$@"
}

invoke_payload() {
  local request_id="$1"
  jq -nc --arg requestId "$request_id" '{
    requestId: $requestId,
    caller: {
      agentId: "anonymous",
      role: "anonymous"
    },
    capability: "rag.search@v1",
    payload: {
      query: "relayorb demo smoke",
      topK: 3
    }
  }'
}

assert_invoke_ok() {
  local body="$TMP_DIR/invoke-ok.json"
  local code
  code="$(curl_status "$body" -X POST "$DEMO_URL/v1/invoke" -H 'content-type: application/json' --data "$(invoke_payload "demo-ok-$(date +%s)")")"
  if [ "$code" != "200" ]; then
    log "expected invoke 200, got $code"
    sed -n '1,200p' "$body" || true
    exit 1
  fi

  jq -e '.status == "ok" and (.requestId|type=="string") and (.traceId|type=="string")' "$body" >/dev/null || {
    log "invoke response missing requestId/traceId"
    sed -n '1,200p' "$body" || true
    exit 1
  }

  log "anonymous invoke returned 200"
}

assert_submit_disabled() {
  local body="$TMP_DIR/submit-disabled.json"
  local code
  code="$(curl_status "$body" -X POST "$DEMO_URL/v1/submit" -H 'content-type: application/json' --data '{}')"
  case "$code" in
    403|404) log "submit endpoint disabled as expected ($code)" ;;
    *)
      log "expected submit to be disabled (403/404), got $code"
      sed -n '1,120p' "$body" || true
      exit 1
      ;;
  esac
}

assert_jobs_disabled() {
  local body="$TMP_DIR/jobs-disabled.json"
  local code
  code="$(curl_status "$body" "$DEMO_URL/v1/jobs/not-a-real-job")"
  case "$code" in
    403|404) log "jobs endpoint disabled as expected ($code)" ;;
    *)
      log "expected jobs to be disabled (403/404), got $code"
      sed -n '1,120p' "$body" || true
      exit 1
      ;;
  esac
}

assert_allowlist_enforced() {
  local body="$TMP_DIR/allowlist.json"
  local payload
  payload="$(jq -nc '{
    requestId: "demo-forbidden",
    caller: {agentId: "anonymous", role: "anonymous"},
    capability: "sql.query@v1",
    payload: {sql: "select 1"}
  }')"
  local code
  code="$(curl_status "$body" -X POST "$DEMO_URL/v1/invoke" -H 'content-type: application/json' --data "$payload")"
  if [ "$code" != "403" ]; then
    log "expected forbidden capability to return 403, got $code"
    sed -n '1,200p' "$body" || true
    exit 1
  fi
  log "capability allowlist enforced"
}

assert_body_limit() {
  if ! command -v python3 >/dev/null 2>&1; then
    log "python3 not found; skipping payload-too-large smoke"
    return 0
  fi

  local payload_file="$TMP_DIR/payload-too-large.json"
  python3 - <<'PY' > "$payload_file"
import json
body = {
  "requestId": "demo-too-large",
  "caller": {"agentId": "anonymous", "role": "anonymous"},
  "capability": "demo.echo@v1",
  "payload": {"text": "a" * 40000}
}
print(json.dumps(body))
PY

  local body="$TMP_DIR/too-large-response.json"
  local code
  code="$(curl_status "$body" -X POST "$DEMO_URL/v1/invoke" -H 'content-type: application/json' --data-binary "@$payload_file")"
  if [ "$code" != "413" ]; then
    log "expected payload too large to return 413, got $code"
    sed -n '1,120p' "$body" || true
    exit 1
  fi
  log "payload limit enforced (413)"
}

assert_rate_limit() {
  local saw_429=0
  local retry_after=""
  for i in $(seq 1 80); do
    local headers_file="$TMP_DIR/rate-limit-$i.headers"
    local body_file="$TMP_DIR/rate-limit-$i.body"
    local code
    code="$(curl -sS -D "$headers_file" -o "$body_file" -w "%{http_code}" -X POST "$DEMO_URL/v1/invoke" -H 'content-type: application/json' --data "$(invoke_payload "demo-rl-$i-$(date +%s)")")"
    if [ "$code" = "429" ]; then
      saw_429=1
      retry_after="$(awk 'tolower($1)=="retry-after:"{print $2}' "$headers_file" | tr -d '\r' | head -n1)"
      break
    fi
  done

  if [ "$saw_429" -ne 1 ]; then
    if [ "$REQUIRE_RATE_LIMIT" = "1" ]; then
      log "expected to observe at least one 429 under rapid fire"
      exit 1
    fi
    log "warning: did not observe 429 under quick hammer; continuing (set RELAYORB_DEMO_REQUIRE_RATE_LIMIT=1 to enforce)"
    return 0
  fi

  if [ -z "$retry_after" ]; then
    if [ "$REQUIRE_RATE_LIMIT" = "1" ]; then
      log "expected Retry-After header on 429"
      exit 1
    fi
    log "warning: observed 429 without Retry-After; continuing (set RELAYORB_DEMO_REQUIRE_RATE_LIMIT=1 to enforce)"
    return 0
  fi

  log "rate limiting enforced (429 with Retry-After=$retry_after)"
}

assert_private_services() {
  local registry_code worker_code
  registry_code="$(curl -sS -o /dev/null -w '%{http_code}' "$REGISTRY_URL/health")"
  worker_code="$(curl -sS -o /dev/null -w '%{http_code}' "$WORKER_URL/health")"

  if [ "$registry_code" != "403" ]; then
    log "expected registry direct health to be 403, got $registry_code"
    exit 1
  fi
  if [ "$worker_code" != "403" ]; then
    log "expected worker direct health to be 403, got $worker_code"
    exit 1
  fi

  log "registry/worker direct access blocked (403)"
}

assert_invoke_ok
assert_submit_disabled
assert_jobs_disabled
assert_allowlist_enforced
assert_body_limit
assert_rate_limit
assert_private_services
log "all demo anonymous smoke checks passed"
