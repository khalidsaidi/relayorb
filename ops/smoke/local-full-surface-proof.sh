#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
SECRET_AUTH_HMAC="${SECRET_AUTH_HMAC:-relayorb-dev-secret}"
START_STACK="${START_STACK:-1}"
STOP_STACK_ON_EXIT="${STOP_STACK_ON_EXIT:-0}"
STACK_WAIT_SECONDS="${STACK_WAIT_SECONDS:-120}"
OPS_DIR="${OPS_DIR:-$ROOT_DIR/ops}"

TMP_DIR="$(mktemp -d /tmp/relayorb-local-proof.XXXXXX)"
STARTED_STACK=0
trap 'rm -rf "$TMP_DIR"; if [ "$STARTED_STACK" = "1" ] && [ "$STOP_STACK_ON_EXIT" = "1" ]; then (cd "$OPS_DIR" && docker compose down >/dev/null 2>&1 || true); fi' EXIT

log() {
  echo "[local-full-surface-proof] $*"
}

fail() {
  echo "[local-full-surface-proof] FAIL: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
}

for cmd in curl jq python3; do
  require_cmd "$cmd"
done

if [ "$START_STACK" = "1" ]; then
  require_cmd docker
fi

hmac_hex() {
  local payload="$1"
  python3 - "$SECRET_AUTH_HMAC" "$payload" <<'PY'
import hashlib
import hmac
import sys

secret = sys.argv[1].encode()
payload = sys.argv[2].encode()
print(hmac.new(secret, payload, hashlib.sha256).hexdigest())
PY
}

gateway_health_code() {
  curl -sS -o /dev/null -w "%{http_code}" "$BASE_URL/health" || true
}

ensure_stack() {
  local code
  code="$(gateway_health_code)"
  if [ "$code" = "200" ]; then
    log "gateway already reachable at $BASE_URL"
    return 0
  fi

  if [ "$START_STACK" != "1" ]; then
    fail "gateway not reachable at $BASE_URL and START_STACK=0"
  fi

  log "starting local stack with docker compose"
  (cd "$OPS_DIR" && docker compose up -d --build)
  STARTED_STACK=1

  local i
  for i in $(seq 1 "$STACK_WAIT_SECONDS"); do
    code="$(gateway_health_code)"
    if [ "$code" = "200" ]; then
      log "gateway is healthy"
      return 0
    fi
    sleep 1
  done

  fail "gateway did not become healthy within ${STACK_WAIT_SECONDS}s"
}

signed_request() {
  local method="$1"
  local path="$2"
  local payload="$3"
  local agent_id="$4"
  local role="$5"
  local body_file="$6"

  local sig
  sig="$(hmac_hex "$payload")"

  local -a curl_args
  curl_args=(
    -sS
    -o "$body_file"
    -w "%{http_code}"
    -X "$method"
    "$BASE_URL$path"
    -H "x-relayorb-signature: $sig"
    -H "x-relayorb-agent-id: $agent_id"
    -H "x-relayorb-role: $role"
  )

  if [ -n "$payload" ]; then
    curl_args+=(
      -H "content-type: application/json"
      --data-binary "$payload"
    )
  fi

  curl "${curl_args[@]}"
}

assert_json() {
  local file="$1"
  jq -e . "$file" >/dev/null 2>&1 || fail "response was not valid JSON: $file"
}

assert_code() {
  local expected="$1"
  local actual="$2"
  local body_file="$3"
  if [ "$expected" != "$actual" ]; then
    sed -n '1,220p' "$body_file" || true
    fail "expected HTTP $expected, got $actual"
  fi
}

ensure_stack

log "checking health endpoint"
health_code="$(curl -sS -o "$TMP_DIR/health.json" -w "%{http_code}" "$BASE_URL/health")"
assert_code "200" "$health_code" "$TMP_DIR/health.json"
assert_json "$TMP_DIR/health.json"
jq -e '.status == "ok" and .data.service == "relayorb-gateway"' "$TMP_DIR/health.json" >/dev/null \
  || fail "health response missing expected gateway fields"

REQUEST_ID="local-proof-$(date +%s)"
CREATOR_AGENT="local-proof-creator"
INTRUDER_AGENT="local-proof-intruder"

invoke_payload="$(jq -nc \
  --arg requestId "$REQUEST_ID" \
  --arg agentId "$CREATOR_AGENT" \
  '{
    requestId: $requestId,
    caller: {agentId: $agentId, role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "local full-surface proof", topK: 3}
  }'
)"

log "invoke: fresh request"
invoke_code="$(signed_request POST "/v1/invoke" "$invoke_payload" "$CREATOR_AGENT" "researcher" "$TMP_DIR/invoke-fresh.json")"
assert_code "200" "$invoke_code" "$TMP_DIR/invoke-fresh.json"
assert_json "$TMP_DIR/invoke-fresh.json"
jq -e '.status == "ok" and (.data.results | length) >= 1 and (.meta.routedTo | type == "string")' "$TMP_DIR/invoke-fresh.json" >/dev/null \
  || fail "fresh invoke response did not include expected data/meta"

log "invoke: replay (same requestId)"
replay_code="$(signed_request POST "/v1/invoke" "$invoke_payload" "$CREATOR_AGENT" "researcher" "$TMP_DIR/invoke-replay.json")"
assert_code "200" "$replay_code" "$TMP_DIR/invoke-replay.json"
assert_json "$TMP_DIR/invoke-replay.json"
jq -e '.status == "ok" and .meta.replayed == true' "$TMP_DIR/invoke-replay.json" >/dev/null \
  || fail "replay invoke did not set meta.replayed=true"

log "invoke: idempotency collision (same requestId, different payload)"
collision_payload="$(jq -nc \
  --arg requestId "$REQUEST_ID" \
  --arg agentId "$CREATOR_AGENT" \
  '{
    requestId: $requestId,
    caller: {agentId: $agentId, role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "local full-surface proof changed", topK: 3}
  }'
)"
collision_code="$(signed_request POST "/v1/invoke" "$collision_payload" "$CREATOR_AGENT" "researcher" "$TMP_DIR/invoke-collision.json")"
assert_code "400" "$collision_code" "$TMP_DIR/invoke-collision.json"
assert_json "$TMP_DIR/invoke-collision.json"
jq -e '.status == "error" and .error.code == "SCHEMA_VALIDATION_FAILED"' "$TMP_DIR/invoke-collision.json" >/dev/null \
  || fail "idempotency collision did not return SCHEMA_VALIDATION_FAILED"

SUBMIT_ID="local-proof-submit-$(date +%s)"
submit_payload="$(jq -nc \
  --arg requestId "$SUBMIT_ID" \
  --arg agentId "$CREATOR_AGENT" \
  '{
    requestId: $requestId,
    caller: {agentId: $agentId, role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "local async proof", topK: 2},
    maxAttempts: 2
  }'
)"

log "submit: create async job"
submit_code="$(signed_request POST "/v1/submit" "$submit_payload" "$CREATOR_AGENT" "researcher" "$TMP_DIR/submit.json")"
case "$submit_code" in
  200|202) ;;
  *)
    sed -n '1,220p' "$TMP_DIR/submit.json" || true
    fail "submit expected 200/202, got $submit_code"
    ;;
esac
assert_json "$TMP_DIR/submit.json"
JOB_ID="$(jq -r '.data.jobId // empty' "$TMP_DIR/submit.json")"
[ -n "$JOB_ID" ] || fail "submit did not return data.jobId"

log "jobs: creator can read"
job_creator_code="$(signed_request GET "/v1/jobs/$JOB_ID" "" "$CREATOR_AGENT" "researcher" "$TMP_DIR/job-creator.json")"
assert_code "200" "$job_creator_code" "$TMP_DIR/job-creator.json"
assert_json "$TMP_DIR/job-creator.json"
jq -e --arg jobId "$JOB_ID" '.status == "ok" and .data.jobId == $jobId' "$TMP_DIR/job-creator.json" >/dev/null \
  || fail "creator read did not return expected job envelope"

log "jobs: non-creator/non-admin is forbidden"
job_intruder_code="$(signed_request GET "/v1/jobs/$JOB_ID" "" "$INTRUDER_AGENT" "researcher" "$TMP_DIR/job-intruder.json")"
assert_code "403" "$job_intruder_code" "$TMP_DIR/job-intruder.json"
assert_json "$TMP_DIR/job-intruder.json"
jq -e '.status == "error" and .error.code == "FORBIDDEN"' "$TMP_DIR/job-intruder.json" >/dev/null \
  || fail "non-creator read did not return FORBIDDEN"

log "jobs: admin role can read"
job_admin_code="$(signed_request GET "/v1/jobs/$JOB_ID" "" "$INTRUDER_AGENT" "admin" "$TMP_DIR/job-admin.json")"
assert_code "200" "$job_admin_code" "$TMP_DIR/job-admin.json"
assert_json "$TMP_DIR/job-admin.json"
jq -e --arg jobId "$JOB_ID" '.status == "ok" and .data.jobId == $jobId' "$TMP_DIR/job-admin.json" >/dev/null \
  || fail "admin read did not return expected job envelope"

log "replay endpoint: request artifact is readable"
replay_artifact_code="$(signed_request GET "/v1/replay/$REQUEST_ID" "" "$CREATOR_AGENT" "researcher" "$TMP_DIR/replay.json")"
assert_code "200" "$replay_artifact_code" "$TMP_DIR/replay.json"
assert_json "$TMP_DIR/replay.json"
jq -e --arg requestId "$REQUEST_ID" '.status == "ok" and .data.requestId == $requestId' "$TMP_DIR/replay.json" >/dev/null \
  || fail "replay artifact did not return expected requestId"

log "batch invoke endpoint: aggregate request handling"
batch_payload="$(jq -nc \
  --arg a "local-batch-a-$(date +%s)" \
  --arg b "local-batch-b-$(date +%s)" \
  --arg agentId "$CREATOR_AGENT" \
  '[
    {
      requestId: $a,
      caller: {agentId: $agentId, role: "researcher"},
      capability: "rag.search@v1",
      payload: {query: "batch A"}
    },
    {
      requestId: $b,
      caller: {agentId: $agentId, role: "researcher"},
      capability: "rag.search@v1",
      payload: {query: "batch B"}
    }
  ]'
)"
batch_code="$(signed_request POST "/v1/batchInvoke" "$batch_payload" "$CREATOR_AGENT" "researcher" "$TMP_DIR/batch.json")"
assert_code "200" "$batch_code" "$TMP_DIR/batch.json"
assert_json "$TMP_DIR/batch.json"
jq -e '.status == "ok" and (.data.results | length) == 2' "$TMP_DIR/batch.json" >/dev/null \
  || fail "batch invoke did not return two result envelopes"

log "metrics endpoint (public mode in local compose)"
metrics_code="$(curl -sS -o "$TMP_DIR/metrics.txt" -w "%{http_code}" "$BASE_URL/metrics")"
assert_code "200" "$metrics_code" "$TMP_DIR/metrics.txt"
grep -q "relayorb_gateway_invoke_requests_total" "$TMP_DIR/metrics.txt" \
  || fail "gateway metrics missing relayorb series"

log "PASS: local full-surface proof succeeded"
if [ "$STARTED_STACK" = "1" ] && [ "$STOP_STACK_ON_EXIT" != "1" ]; then
  log "local stack was started and left running (set STOP_STACK_ON_EXIT=1 to auto-stop)"
fi
