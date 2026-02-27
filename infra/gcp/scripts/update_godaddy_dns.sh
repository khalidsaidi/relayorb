#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 ]]; then
  echo "usage: $0 <domain> <host> <type> <value> [ttl]" >&2
  exit 1
fi

DOMAIN="$1"
HOST="$2"
TYPE="$3"
VALUE="$4"
TTL="${5:-600}"

API_KEY="$(gcloud secrets versions access latest --secret=godaddy-api-key)"
API_SECRET="$(gcloud secrets versions access latest --secret=godaddy-api-secret)"

BODY="[{\"data\":\"${VALUE}\",\"ttl\":${TTL}}]"

curl -sS -X PUT "https://api.godaddy.com/v1/domains/${DOMAIN}/records/${TYPE}/${HOST}" \
  -H "Authorization: sso-key ${API_KEY}:${API_SECRET}" \
  -H "Content-Type: application/json" \
  -d "${BODY}" >/dev/null

echo "updated DNS record type=${TYPE} host=${HOST} domain=${DOMAIN}"
