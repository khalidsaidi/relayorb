#!/usr/bin/env bash
set -euo pipefail

# PURPOSE:
#   Deploy/verify RelayOrb demo posture end-to-end.
#   Proves:
#     - anonymous invoke works via demo LB URL
#     - gateway run.app cannot bypass LB/Cloud Armor (ingress lock)
#     - registry + worker are private (no public invoker)
#     - demo safety gates trigger (submit/jobs disabled, payload cap, rate limit)

TF_DIR="${TF_DIR:-infra/gcp/terraform/envs/demo}"
DEMO_PROJECT_ID="${DEMO_PROJECT_ID:-relayorb-demo}"
DEMO_REGION="${DEMO_REGION:-us-central1}"

GW_SVC="${GW_SVC:-relayorb-gateway-demo}"
REG_SVC="${REG_SVC:-relayorb-registry-demo}"
RAG_SVC="${RAG_SVC:-relayorb-rag-demo}"
SCRAPER_SVC="${SCRAPER_SVC:-relayorb-metrics-scraper-demo}"
HEALTH_PATH="${HEALTH_PATH:-/health}"
CHECK_RATE_LIMIT="${CHECK_RATE_LIMIT:-0}"

# Optional: set APPLY_TERRAFORM=1 to apply from this script.
APPLY_TERRAFORM="${APPLY_TERRAFORM:-0}"
DEMO_LB_URL="${DEMO_LB_URL:-}"

PASS_COUNT=0
PASS_LABELS=()

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "missing required command: $cmd" >&2
    exit 2
  fi
}

for cmd in gcloud terraform curl jq; do
  require_cmd "$cmd"
done

log() {
  echo "[demo-deploy-verify] $*"
}

pass() {
  local label="$1"
  PASS_LABELS+=("$label")
  PASS_COUNT=$((PASS_COUNT + 1))
  log "PASS: ${label}"
}

summary() {
  echo
  echo "== Summary =="
  echo "demo_lb_url=${DEMO_LB_URL}"
  echo "gateway_run_url=${GW_RUN_URL:-unknown}"
  echo "registry_run_url=${REG_RUN_URL:-unknown}"
  echo "worker_run_url=${RAG_RUN_URL:-unknown}"
  echo "checks_passed=${PASS_COUNT}"
  for label in "${PASS_LABELS[@]}"; do
    echo "  - ${label}"
  done
}

fail() {
  local code="$1"
  shift
  echo "[demo-deploy-verify] FAIL: $*" >&2
  summary || true
  exit "${code}"
}

http_code() {
  local url="$1"
  curl -sS -o /dev/null -w "%{http_code}" "$url" || true
}

echo "== Pre-flight: project/region =="
# Keep script side-effect free for user gcloud state.
export CLOUDSDK_CORE_PROJECT="${DEMO_PROJECT_ID}"
export CLOUDSDK_RUN_REGION="${DEMO_REGION}"
pass "pre-flight gcloud project/region scoped via env"

echo "== Pre-flight: terraform init/validate =="
terraform -chdir="${TF_DIR}" init -input=false >/dev/null
terraform -chdir="${TF_DIR}" validate >/dev/null
pass "terraform init/validate"

echo "== Pre-flight: demo guardrails in gateway code =="
if command -v rg >/dev/null 2>&1; then
  rg -n "AUTH_MODE=none|PUBLIC_DEMO_MODE|RELAYORB_ENV=demo|RELAYORB_ENV=prod requires AUTH_MODE=oidc" \
    crates/relayorb-gateway/src/main.rs >/dev/null || true
else
  grep -En "AUTH_MODE=none|PUBLIC_DEMO_MODE|RELAYORB_ENV=demo|RELAYORB_ENV=prod requires AUTH_MODE=oidc" \
    crates/relayorb-gateway/src/main.rs >/dev/null || true
fi
pass "gateway demo guardrails present"

if [[ "${APPLY_TERRAFORM}" == "1" ]]; then
  log "Applying demo terraform stack"
  terraform -chdir="${TF_DIR}" apply -auto-approve \
    -var="project_id=${DEMO_PROJECT_ID}" \
    -var="region=${DEMO_REGION}"
  pass "terraform apply"
else
  log "Skipping terraform apply (set APPLY_TERRAFORM=1 to enable)"
fi

echo "== Resolve service URLs =="
GW_RUN_URL="$(gcloud run services describe "${GW_SVC}" --region "${DEMO_REGION}" --format='value(status.url)')"
REG_RUN_URL="$(gcloud run services describe "${REG_SVC}" --region "${DEMO_REGION}" --format='value(status.url)')"
RAG_RUN_URL="$(gcloud run services describe "${RAG_SVC}" --region "${DEMO_REGION}" --format='value(status.url)')"

log "GW_RUN_URL=${GW_RUN_URL}"
log "REG_RUN_URL=${REG_RUN_URL}"
log "RAG_RUN_URL=${RAG_RUN_URL}"
pass "resolved run.app service URLs"

echo "== Resolve demo LB URL =="
if [[ -z "${DEMO_LB_URL}" ]]; then
  DEMO_HTTPS_URL="$(terraform -chdir="${TF_DIR}" output -raw demo_https_url 2>/dev/null || true)"
  if [[ -n "${DEMO_HTTPS_URL}" ]]; then
    DEMO_LB_URL="${DEMO_HTTPS_URL}"
  else
    DEMO_HTTP_URL="$(terraform -chdir="${TF_DIR}" output -raw demo_http_url 2>/dev/null || true)"
    DEMO_LB_URL="${DEMO_HTTP_URL}"
  fi
fi
if [[ -z "${DEMO_LB_URL}" ]]; then
  fail 20 "unable to resolve demo LB URL (tried outputs: demo_https_url, demo_http_url). Set DEMO_LB_URL=https://... and rerun."
fi
log "DEMO_LB_URL=${DEMO_LB_URL}"
pass "resolved demo LB URL"

echo "== BYPASS CHECK: gateway run.app must not be directly reachable =="
GW_DIRECT_STATUS="$(http_code "${GW_RUN_URL}${HEALTH_PATH}")"
log "gateway run.app status=${GW_DIRECT_STATUS}"
if [[ "${GW_DIRECT_STATUS}" == "200" ]]; then
  fail 30 "gateway run.app is publicly reachable (bypass risk)"
fi
pass "gateway run.app bypass blocked"

echo "== LB CHECK: health must be reachable via LB =="
LB_HEALTH_STATUS="$(http_code "${DEMO_LB_URL}${HEALTH_PATH}")"
log "lb health status=${LB_HEALTH_STATUS}"
[[ "${LB_HEALTH_STATUS}" == "200" ]] || fail 31 "LB health is not 200"
pass "LB health reachable"

echo "== PRIVATE CHECKS: registry + worker unauth must be blocked =="
REG_STATUS="$(http_code "${REG_RUN_URL}${HEALTH_PATH}")"
RAG_STATUS="$(http_code "${RAG_RUN_URL}${HEALTH_PATH}")"
log "registry status=${REG_STATUS}"
log "worker status=${RAG_STATUS}"
[[ "${REG_STATUS}" == "403" ]] || fail 40 "expected registry unauth status 403"
[[ "${RAG_STATUS}" == "403" ]] || fail 41 "expected worker unauth status 403"
pass "registry and worker private (403 unauth)"

echo "== IAM POLICY CHECKS: no allUsers invoker on registry/worker =="
REG_POLICY_JSON="$(gcloud run services get-iam-policy "${REG_SVC}" --region "${DEMO_REGION}" --format=json)"
RAG_POLICY_JSON="$(gcloud run services get-iam-policy "${RAG_SVC}" --region "${DEMO_REGION}" --format=json)"

if echo "${REG_POLICY_JSON}" \
  | jq -e '.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")' >/dev/null; then
  fail 50 "registry has public invoker binding"
fi
if echo "${RAG_POLICY_JSON}" \
  | jq -e '.bindings[]? | select(.role=="roles/run.invoker") | .members[]? | select(.=="allUsers" or .=="allAuthenticatedUsers")' >/dev/null; then
  fail 51 "worker has public invoker binding"
fi
log "No allUsers invoker on registry/worker"
pass "registry/worker IAM policy has no public invoker"

echo "== DEMO API CHECKS: invoke/restrictions/limits/rate =="
RELAYORB_DEMO_REQUIRE_RATE_LIMIT="${CHECK_RATE_LIMIT}" \
  bash ops/smoke/demo-anon-smoke.sh "${DEMO_LB_URL}" "${REG_RUN_URL}" "${RAG_RUN_URL}"
pass "demo API behavior smoke"

echo "== Optional scraper quick logs check =="
if gcloud run services describe "${SCRAPER_SVC}" --region "${DEMO_REGION}" >/dev/null 2>&1; then
  log "Scraper exists; recent logs:"
  gcloud logging read \
    "resource.type=cloud_run_revision AND resource.labels.service_name=${SCRAPER_SVC}" \
    --limit 30 \
    --format="value(textPayload)" || true
else
  log "Scraper service not found; skipping scraper logs check"
fi

echo
summary
log "DONE: demo posture checks passed"
