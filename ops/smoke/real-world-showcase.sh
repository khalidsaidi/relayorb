#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
SECRET_AUTH_HMAC="${SECRET_AUTH_HMAC:-relayorb-dev-secret}"
TMP_DIR="$(mktemp -d /tmp/relayorb-showcase.XXXXXX)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

sign_payload() {
  local payload="$1"
  python3 - "$SECRET_AUTH_HMAC" "$payload" <<'PY'
import hmac
import hashlib
import sys

secret = sys.argv[1].encode()
payload = sys.argv[2].encode()
print(hmac.new(secret, payload, hashlib.sha256).hexdigest())
PY
}

signed_request() {
  local method="$1"
  local path="$2"
  local payload="$3"
  local agent_id="$4"
  local role="$5"
  local outfile="$6"

  local sig
  sig="$(sign_payload "$payload")"

  curl -sS -X "$method" \
    -H "content-type: application/json" \
    -H "x-relayorb-signature: $sig" \
    -H "x-relayorb-agent-id: $agent_id" \
    -H "x-relayorb-role: $role" \
    --data-binary "$payload" \
    -o "$outfile" \
    -w "%{http_code}" \
    "$BASE_URL$path"
}

echo "Scenario 1: Multi-source analyst brief (batch invoke)"
batch_payload="$(jq -nc '
[
  {
    requestId: ("scenario1-a-" + (now|tostring)),
    caller: {agentId: "analyst-01", role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "United States Consumer Price Index latest release", topK: 2}
  },
  {
    requestId: ("scenario1-b-" + (now|tostring)),
    caller: {agentId: "analyst-01", role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "Federal funds rate", topK: 2}
  },
  {
    requestId: ("scenario1-c-" + (now|tostring)),
    caller: {agentId: "analyst-01", role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "Brent crude benchmark", topK: 2}
  },
  {
    requestId: ("scenario1-d-" + (now|tostring)),
    caller: {agentId: "analyst-01", role: "researcher"},
    capability: "rag.search@v1",
    payload: {query: "NVIDIA market capitalization", topK: 2}
  }
]
')"
batch_code="$(signed_request POST "/v1/batchInvoke" "$batch_payload" "analyst-01" "researcher" "$TMP_DIR/batch.json")"
echo "  HTTP: $batch_code"
jq -r '
  .data.results[]
  | "  - " + .response.requestId
    + " | provider=" + (.response.data.provider // "-")
    + " | latencyMs=" + ((.response.meta.latencyMs // -1)|tostring)
    + "\n    top: " + (.response.data.results[0].text // "-")
' "$TMP_DIR/batch.json"
echo

echo "Scenario 2: Async job + access control"
req_id="scenario2-$(date +%s)"
submit_payload="$(jq -nc --arg rid "$req_id" '
{
  requestId: $rid,
  caller: {agentId: "analyst-01", role: "researcher"},
  capability: "rag.search@v1",
  payload: {query: "WHO pandemic treaty timeline", topK: 3}
}
')"
submit_code="$(signed_request POST "/v1/submit" "$submit_payload" "analyst-01" "researcher" "$TMP_DIR/submit.json")"
job_id="$(jq -r '.data.jobId' "$TMP_DIR/submit.json")"
echo "  submit HTTP: $submit_code"
echo "  job_id: $job_id"

for attempt in 1 2 3 4 5; do
  job_code="$(signed_request GET "/v1/jobs/$job_id" "" "analyst-01" "researcher" "$TMP_DIR/job.json")"
  state="$(jq -r '.data.state // "unknown"' "$TMP_DIR/job.json")"
  echo "  poll #$attempt: HTTP=$job_code state=$state"
  if [ "$state" = "succeeded" ]; then
    break
  fi
  sleep 1
done
jq -r '
  "  result provider=" + (.data.result.provider // "-"),
  "  result top=" + (.data.result.results[0].text // "-")
' "$TMP_DIR/job.json"

forbidden_code="$(signed_request GET "/v1/jobs/$job_id" "" "intern-007" "viewer" "$TMP_DIR/forbidden.json")"
echo "  viewer read HTTP: $forbidden_code"
jq -r '
  "  forbidden code=" + (.error.code // "-"),
  "  forbidden message=" + (.error.message // "-")
' "$TMP_DIR/forbidden.json"
echo

echo "Scenario 3: Reliability guardrails (replay + idempotency)"
replay_req="scenario3-$(date +%s)"
invoke_payload="$(jq -nc --arg rid "$replay_req" '
{
  requestId: $rid,
  caller: {agentId: "agent-reliability", role: "researcher"},
  capability: "rag.search@v1",
  payload: {query: "OECD inflation outlook", topK: 2}
}
')"
invoke_mutated="$(jq -nc --arg rid "$replay_req" '
{
  requestId: $rid,
  caller: {agentId: "agent-reliability", role: "researcher"},
  capability: "rag.search@v1",
  payload: {query: "OECD growth outlook", topK: 2}
}
')"

first_code="$(signed_request POST "/v1/invoke" "$invoke_payload" "agent-reliability" "researcher" "$TMP_DIR/invoke-first.json")"
replay_code="$(signed_request POST "/v1/invoke" "$invoke_payload" "agent-reliability" "researcher" "$TMP_DIR/invoke-replay.json")"
mutated_code="$(signed_request POST "/v1/invoke" "$invoke_mutated" "agent-reliability" "researcher" "$TMP_DIR/invoke-mutated.json")"

echo "  first call HTTP: $first_code"
echo "  replay call HTTP: $replay_code"
echo "  mutated same-requestId HTTP: $mutated_code"
jq -r '
  "  replayed=" + ((.meta.replayed // false)|tostring),
  "  replay traceId=" + (.traceId // "-")
' "$TMP_DIR/invoke-replay.json"
jq -r '
  "  mutation error code=" + (.error.code // "-"),
  "  mutation error message=" + (.error.message // "-")
' "$TMP_DIR/invoke-mutated.json"
