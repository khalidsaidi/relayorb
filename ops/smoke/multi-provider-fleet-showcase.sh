#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
REGISTRY_URL="${REGISTRY_URL:-http://127.0.0.1:8081}"
SECRET_AUTH_HMAC="${SECRET_AUTH_HMAC:-relayorb-dev-secret}"
KEEP_FLEET="${KEEP_FLEET:-0}"
NETWORK="${NETWORK:-ops_default}"
TTL_SECONDS="${TTL_SECONDS:-20}"
HEARTBEAT_SECONDS="${HEARTBEAT_SECONDS:-5}"
BUILD_WORKER="${BUILD_WORKER:-0}"

TMP_DIR="$(mktemp -d /tmp/relayorb-fleet-showcase.XXXXXX)"

# name port live_backend response_delay_ms provider_name
PROVIDERS=(
  "relayorb-fleet-wiki-a 8111 wikipedia 0 wikipedia-search-a"
  "relayorb-fleet-hn-a 8112 hackernews 80 hackernews-search-a"
  "relayorb-fleet-openlibrary-a 8113 openlibrary 120 openlibrary-search-a"
  "relayorb-fleet-wiki-b 8114 wikipedia 180 wikipedia-search-b"
  "relayorb-fleet-hn-b 8115 hackernews 240 hackernews-search-b"
  "relayorb-fleet-openlibrary-b 8116 openlibrary 300 openlibrary-search-b"
)

cleanup() {
  if [ "$KEEP_FLEET" != "1" ]; then
    for row in "${PROVIDERS[@]}"; do
      set -- $row
      docker rm -f "$1" >/dev/null 2>&1 || true
    done
  fi
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

signed_invoke() {
  local query="$1"
  local request_id="fleet-$(date +%s%N)"
  local payload
  payload="$(jq -nc \
    --arg rid "$request_id" \
    --arg query "$query" \
    '{
      requestId: $rid,
      caller: {agentId: "fleet-showcase-user", role: "researcher"},
      capability: "rag.search@v1",
      payload: {query: $query, topK: 2}
    }'
  )"
  local sig
  sig="$(sign_payload "$payload")"

  curl -sS -X POST "$BASE_URL/v1/invoke" \
    -H "content-type: application/json" \
    -H "x-relayorb-signature: $sig" \
    -H "x-relayorb-agent-id: fleet-showcase-user" \
    -H "x-relayorb-role: researcher" \
    --data-binary "$payload"
}

warm_provider() {
  local port="$1"
  local name="$2"
  local payload
  payload="$(jq -nc \
    --arg rid "warm-${name}-$(date +%s%N)" \
    --arg trace "warm-trace-${name}-$(date +%s%N)" \
    --arg q "warmup ${name}" \
    '{requestId: $rid, traceId: $trace, payload: {query: $q, topK: 1}}'
  )"

  curl -sS -X POST \
    -H "content-type: application/json" \
    --data-binary "$payload" \
    "http://127.0.0.1:${port}/invoke/rag.search@v1" >/dev/null
}

echo "Step 1/5: Ensure base stack is running"
(
  cd /home/khali/relayorb/ops
  if [ "$BUILD_WORKER" = "1" ]; then
    docker compose build worker >/dev/null
  fi
  RAG_LIVE_SEARCH=1 docker compose up -d gateway registry otel-collector postgres >/dev/null
  docker compose stop worker >/dev/null || true
)

echo "Step 2/5: Start a 6-provider real-world fleet"
for row in "${PROVIDERS[@]}"; do
  set -- $row
  name="$1"
  port="$2"
  backend="$3"
  delay_ms="$4"
  provider_name="$5"

  docker rm -f "$name" >/dev/null 2>&1 || true
  docker run -d \
    --name "$name" \
    --network "$NETWORK" \
    -p "${port}:${port}" \
    -e RELAYORB_ENV=dev \
    -e RELAYORB_VERSION=dev \
    -e RELAYORB_SERVICE_NAME="$name" \
    -e REGISTRY_URL=http://registry:8081 \
    -e WORKER_BIND_ADDR="0.0.0.0:${port}" \
    -e WORKER_BASE_URL="http://${name}:${port}" \
    -e RELAYORB_PUBLIC_BASE_URL="http://${name}:${port}" \
    -e WORKER_INSTANCE_ID="${name}-1" \
    -e RELAYORB_REGION=us-central1 \
    -e WORKER_TTL_SECONDS="$TTL_SECONDS" \
    -e WORKER_HEARTBEAT_INTERVAL_SECONDS="$HEARTBEAT_SECONDS" \
    -e RAG_LIVE_SEARCH=1 \
    -e RAG_LIVE_BACKEND="$backend" \
    -e RAG_RESPONSE_DELAY_MS="$delay_ms" \
    -e RAG_PROVIDER_NAME="$provider_name" \
    -e OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317 \
    -e RELAYORB_METRICS_EXPORTER=prometheus \
    -e METRICS_AUTH_MODE=public \
    ops-worker >/dev/null
done

echo "Step 3/5: Warm providers so registry has real latency stats"
echo "Waiting for stale compose worker registration to expire..."
for _ in $(seq 1 90); do
  if ! curl -sS "$REGISTRY_URL/v1/capabilities/rag.search@v1?env=dev" \
    | jq -e '.data.providers[]? | select(.serviceName == "relayorb-rag-dev")' >/dev/null; then
    break
  fi
  sleep 1
done

if curl -sS "$REGISTRY_URL/v1/capabilities/rag.search@v1?env=dev" \
  | jq -e '.data.providers[]? | select(.serviceName == "relayorb-rag-dev")' >/dev/null; then
  echo "Warning: stale relayorb-rag-dev provider is still registered; first invoke may time out."
fi

sleep 2
for row in "${PROVIDERS[@]}"; do
  set -- $row
  warm_provider "$2" "$1"
done
sleep $((HEARTBEAT_SECONDS + 2))

echo "Registry view (provider count + latency):"
curl -sS "$REGISTRY_URL/v1/capabilities/rag.search@v1?env=dev" \
  | jq '{
      providerCount: (.data.providers | length),
      providers: (
        .data.providers
        | map({
            serviceName,
            healthy,
            latencyMs: (.stats.recentLatencyMs // null),
            baseUrl
          })
        | sort_by(.latencyMs)
      )
    }'

echo
echo "Step 4/5: Real user calls through RelayOrb"
first_output_file="$TMP_DIR/call-1.json"
second_output_file="$TMP_DIR/call-2.json"
third_output_file="$TMP_DIR/call-3.json"
for q in \
  "Federal funds rate latest" \
  "Brent crude benchmark" \
  "NVIDIA market capitalization"; do
  echo "Query: $q"
  output="$(signed_invoke "$q")"
  if [ ! -f "$first_output_file" ]; then
    printf '%s' "$output" >"$first_output_file"
  elif [ ! -f "$second_output_file" ]; then
    printf '%s' "$output" >"$second_output_file"
  else
    printf '%s' "$output" >"$third_output_file"
  fi
  printf '%s' "$output" \
    | jq '{status,provider: .data.provider,routedTo: .meta.routedTo,latencyMs: .meta.latencyMs,top: .data.results[0].text,error}'
done

echo
echo "Step 5/5: Kill the currently selected provider, then show failover"
active_host=""
for call_file in "$first_output_file" "$second_output_file" "$third_output_file"; do
  candidate_host="$(jq -r '.meta.routedTo // ""' "$call_file" | sed -E 's#https?://([^:/]+).*#\1#')"
  if [ -n "$candidate_host" ]; then
    active_host="$candidate_host"
    break
  fi
done
if [ -z "$active_host" ]; then
  echo "Could not determine active host from query responses"
  exit 1
fi
echo "Stopping active host: $active_host"
docker stop "$active_host" >/dev/null

echo "Immediate call after failure (before TTL convergence):"
signed_invoke "US CPI release" \
  | jq '{status,provider: .data.provider,routedTo: .meta.routedTo,latencyMs: .meta.latencyMs,error}'

echo "Waiting for TTL expiry (${TTL_SECONDS}s + buffer)..."
sleep $((TTL_SECONDS + HEARTBEAT_SECONDS + 2))

echo "Post-TTL registry view:"
curl -sS "$REGISTRY_URL/v1/capabilities/rag.search@v1?env=dev" \
  | jq '{
      providerCount: (.data.providers | length),
      providers: (
        .data.providers
        | map({
            serviceName,
            healthy,
            latencyMs: (.stats.recentLatencyMs // null),
            baseUrl
          })
        | sort_by(.latencyMs)
      )
    }'

echo "Call after TTL convergence (should route to next best healthy provider):"
signed_invoke "US CPI release" \
  | jq '{status,provider: .data.provider,routedTo: .meta.routedTo,latencyMs: .meta.latencyMs,top: .data.results[0].text,error}'

if [ "$KEEP_FLEET" = "1" ]; then
  echo "Fleet containers kept running (KEEP_FLEET=1)."
else
  echo "Fleet containers will be cleaned up on exit."
fi
