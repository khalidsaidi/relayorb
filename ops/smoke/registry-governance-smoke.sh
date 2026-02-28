#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "usage: $0 <registry_url>"
  exit 2
fi

for cmd in curl jq; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd"
    exit 2
  fi
done

REGISTRY_URL="${1%/}"
GOVERNED_CAPABILITY="${GOVERNED_CAPABILITY:-rag.search@v1}"
EXPECTED_OWNER_SERVICE="${EXPECTED_OWNER_SERVICE:-relayorb-rag-prod}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-24}"
SLEEP_SECONDS="${SLEEP_SECONDS:-5}"
SMOKE_ENV="${SMOKE_ENV:-prod}"
OVERRIDE_ENV="${OVERRIDE_ENV:-dev}"

TMP_DIR="$(mktemp -d /tmp/relayorb-registry-smoke.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[registry-governance-smoke] $*"
}

curl_json() {
  local method="$1"
  local url="$2"
  local body_file="$3"
  local data="${4:-}"

  if [ "$data" = "" ]; then
    curl -sS -o "$body_file" -w "%{http_code}" -X "$method" "$url"
  else
    curl -sS -o "$body_file" -w "%{http_code}" -X "$method" \
      -H "content-type: application/json" \
      --data "$data" \
      "$url"
  fi
}

wait_for_health() {
  local body="$TMP_DIR/health.json"
  local code=""

  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    code="$(curl_json GET "$REGISTRY_URL/health" "$body")"
    if [ "$code" = "200" ] && jq -e '.status == "ok" and .data.ok == true' "$body" >/dev/null; then
      log "health check passed (attempt $attempt)"
      return 0
    fi
    log "health check not ready yet (attempt $attempt/$MAX_ATTEMPTS, status=$code)"
    sleep "$SLEEP_SECONDS"
  done

  log "health check failed"
  sed -n '1,120p' "$body" || true
  return 1
}

wait_for_owner_provider() {
  local body="$TMP_DIR/owner_lookup.json"
  local code=""

  for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
    code="$(curl_json GET "$REGISTRY_URL/v1/capabilities/$GOVERNED_CAPABILITY" "$body")"
    if [ "$code" = "200" ]; then
      local count
      count="$(jq -r --arg svc "$EXPECTED_OWNER_SERVICE" '[.data.providers[]? | select(.serviceName == $svc and .healthy == true)] | length' "$body")"
      if [ "$count" -gt 0 ]; then
        log "owner provider visible and healthy (count=$count, attempt $attempt)"
        cat "$body" > "$TMP_DIR/governed_capability.json"
        return 0
      fi
      log "owner provider not healthy/visible yet (attempt $attempt/$MAX_ATTEMPTS)"
    else
      log "governed capability lookup returned status=$code (attempt $attempt/$MAX_ATTEMPTS)"
    fi
    sleep "$SLEEP_SECONDS"
  done

  log "owner provider check failed"
  sed -n '1,180p' "$body" || true
  return 1
}

assert_non_owner_forbidden() {
  local manifest
  manifest="$(jq -c '.data.manifest' "$TMP_DIR/governed_capability.json")"
  local payload
  payload="$(jq -nc \
    --arg req "smoke-non-owner-$(date +%s)" \
    --arg iid "smoke-evil-$(date +%s)" \
    --arg env "$SMOKE_ENV" \
    --argjson m "$manifest" \
    '{requestId:$req,instanceId:$iid,serviceName:"evil-worker-prod",baseUrl:"https://example.invalid",env:$env,ttlSeconds:60,capabilities:[$m]}'
  )"

  local body="$TMP_DIR/non_owner.json"
  local code
  code="$(curl_json POST "$REGISTRY_URL/v1/register" "$body" "$payload")"

  if [ "$code" != "403" ]; then
    log "expected 403 for non-owner governed registration, got $code"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  local err_code
  err_code="$(jq -r '.error.code // ""' "$body")"
  if [ "$err_code" != "FORBIDDEN" ]; then
    log "expected FORBIDDEN error code, got '$err_code'"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  log "non-owner governed registration correctly blocked (403/FORBIDDEN)"
}

assert_ungoverned_allowed() {
  local payload
  payload="$(jq -nc \
    --arg req "smoke-ungoverned-$(date +%s)" \
    --arg env "$SMOKE_ENV" \
    '{
      requestId: $req,
      instanceId: "smoke-demo-governance",
      serviceName: "smoke-demo-prod",
      baseUrl: "https://example.invalid",
      env: $env,
      ttlSeconds: 60,
      capabilities: [
        {
          capabilityId: "demo.echo@v1",
          sideEffects: "read_only",
          inputSchema: {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            required: ["text"],
            properties: {text: {type: "string"}},
            additionalProperties: false
          },
          outputSchema: {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            required: ["echo"],
            properties: {echo: {type: "string"}},
            additionalProperties: false
          },
          errorSchema: {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            required: ["requestId", "traceId", "status", "error"],
            properties: {
              requestId: {type: "string"},
              traceId: {type: "string"},
              status: {const: "error"},
              error: {
                type: "object",
                required: ["code", "message", "details"],
                properties: {
                  code: {type: "string"},
                  message: {type: "string"},
                  details: {type: "object"}
                },
                additionalProperties: true
              }
            },
            additionalProperties: true
          },
          limits: {
            timeoutMs: 3000,
            maxRetries: 1
          },
          routing: {
            strategy: "lowest_latency",
            regionAffinity: null
          }
        }
      ]
    }'
  )"

  local body="$TMP_DIR/ungoverned.json"
  local code
  code="$(curl_json POST "$REGISTRY_URL/v1/register" "$body" "$payload")"

  if [ "$code" != "200" ]; then
    log "expected 200 for ungoverned registration, got $code"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  if ! jq -e '.status == "ok" and .data.acknowledged == true' "$body" >/dev/null; then
    log "ungoverned registration response missing acknowledgement"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  log "ungoverned registration allowed (200/acknowledged=true)"
}

assert_env_override_blocked() {
  local body="$TMP_DIR/env_override.json"
  local code
  code="$(curl_json GET "$REGISTRY_URL/v1/capabilities/$GOVERNED_CAPABILITY?env=$OVERRIDE_ENV" "$body")"

  if [ "$code" != "403" ]; then
    log "expected 403 for env override in prod, got $code"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  local err_code
  err_code="$(jq -r '.error.code // ""' "$body")"
  if [ "$err_code" != "FORBIDDEN" ]; then
    log "expected FORBIDDEN for env override, got '$err_code'"
    sed -n '1,200p' "$body" || true
    return 1
  fi

  log "cross-env override blocked in prod (403/FORBIDDEN)"
}

log "starting governance smoke against $REGISTRY_URL"
wait_for_health
wait_for_owner_provider
assert_non_owner_forbidden
assert_ungoverned_allowed
assert_env_override_blocked
log "all governance smoke checks passed"
