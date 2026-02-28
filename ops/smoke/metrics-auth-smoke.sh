#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ]; then
  echo "usage: $0 <service_base_url> <metrics_bearer_token>"
  exit 2
fi

for cmd in curl; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd"
    exit 2
  fi
done

SERVICE_URL="${1%/}"
METRICS_TOKEN="$2"
METRICS_PATH="${METRICS_PATH:-/metrics}"
METRICS_URL="${SERVICE_URL}${METRICS_PATH}"
TMP_DIR="$(mktemp -d /tmp/relayorb-metrics-smoke.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

log() {
  echo "[metrics-auth-smoke] $*"
}

curl_status() {
  local body_file="$1"
  shift
  curl -sS -o "$body_file" -w "%{http_code}" "$@"
}

UNAUTH_BODY="$TMP_DIR/metrics-unauth.txt"
UNAUTH_CODE="$(curl_status "$UNAUTH_BODY" "$METRICS_URL")"
if [ "$UNAUTH_CODE" != "401" ]; then
  log "expected 401 for unauthenticated metrics access, got $UNAUTH_CODE"
  sed -n '1,80p' "$UNAUTH_BODY" || true
  exit 1
fi
log "unauthenticated metrics request correctly returned 401"

AUTH_BODY="$TMP_DIR/metrics-auth.txt"
AUTH_CODE="$(curl_status "$AUTH_BODY" -H "Authorization: Bearer $METRICS_TOKEN" "$METRICS_URL")"
if [ "$AUTH_CODE" != "200" ]; then
  log "expected 200 for authenticated metrics access, got $AUTH_CODE"
  sed -n '1,80p' "$AUTH_BODY" || true
  exit 1
fi

if [ ! -s "$AUTH_BODY" ]; then
  log "authenticated metrics request returned 200 with empty body"
else
  log "authenticated metrics request returned 200 with non-empty body"
fi
