#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
EXPECTED_REGION="us-west1"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

resolve_project_id() {
  if [ -n "${PROJECT_ID:-}" ]; then
    echo "$PROJECT_ID"
    return
  fi
  if command -v gcloud >/dev/null 2>&1; then
    gcloud config get-value project 2>/dev/null || true
  fi
}

require_project_id() {
  local pid
  pid=$(resolve_project_id)
  if [ -z "$pid" ]; then
    echo "PROJECT_ID is required (set env PROJECT_ID or configure gcloud)." >&2
    exit 1
  fi
  echo "$pid"
}

resolve_region() {
  local region="${REGION:-$EXPECTED_REGION}"
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to run outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  echo "$region"
}

require_us_west1_zone() {
  local zone="$1"
  if [[ "$zone" != ${EXPECTED_REGION}-* ]]; then
    echo "Refusing to run outside ${EXPECTED_REGION}-* (got: $zone)." >&2
    exit 1
  fi
}

resolve_image() {
  local name="$1"
  local tag="${IMAGE_TAG:-latest}"
  local project
  project=$(require_project_id)
  echo "gcr.io/${project}/${name}:${tag}"
}

ensure_run_service_exists() {
  local service="$1"
  local region="$2"
  require_cmd gcloud
  if gcloud run services describe "$service" --region "$region" >/dev/null 2>&1; then
    return 0
  fi
  if [ "${ALLOW_CREATE:-false}" = "true" ]; then
    echo "Service $service not found; ALLOW_CREATE=true so creating a new service." >&2
    return 0
  fi
  echo "Service $service not found in $region. Set ALLOW_CREATE=true to create it." >&2
  exit 1
}

ensure_run_job_exists() {
  local job="$1"
  local region="$2"
  require_cmd gcloud
  if gcloud run jobs describe "$job" --region "$region" >/dev/null 2>&1; then
    return 0
  fi
  if [ "${ALLOW_CREATE:-false}" = "true" ]; then
    echo "Job $job not found; ALLOW_CREATE=true so creating a new job." >&2
    return 0
  fi
  echo "Job $job not found in $region. Set ALLOW_CREATE=true to create it." >&2
  exit 1
}

build_image() {
  local dir="$1"
  local image="$2"
  require_cmd gcloud
  gcloud builds submit --tag "$image" "$dir"
}

deploy_run_service() {
  local service="$1"
  local image="$2"
  local region="$3"
  local allow_unauth="${4:-false}"
  local extra_env="${5:-}"
  require_cmd gcloud
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to deploy $service outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  ensure_run_service_exists "$service" "$region"

  local args=(run deploy "$service" --image "$image" --region "$region" --platform managed)
  if [ "$allow_unauth" = "true" ]; then
    args+=(--allow-unauthenticated)
  else
    args+=(--no-allow-unauthenticated)
  fi
  local envs="RUN_REGION=$EXPECTED_REGION"
  if [ -n "$extra_env" ]; then
    envs="${envs}|${extra_env}"
  fi
  args+=(--update-env-vars "^|^${envs}")

  gcloud "${args[@]}"
}

deploy_run_job() {
  local job="$1"
  local image="$2"
  local region="$3"
  local extra_env="${4:-}"
  require_cmd gcloud
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to deploy $job outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  ensure_run_job_exists "$job" "$region"

  local args=(run jobs deploy "$job" --image "$image" --region "$region")
  local envs="RUN_REGION=$EXPECTED_REGION"
  if [ -n "$extra_env" ]; then
    envs="${envs}|${extra_env}"
  fi
  args+=(--update-env-vars "^|^${envs}")
  if [ -n "${JOB_TASKS:-}" ]; then
    args+=(--tasks "$JOB_TASKS")
  fi
  if [ -n "${JOB_MAX_RETRIES:-}" ]; then
    args+=(--max-retries "$JOB_MAX_RETRIES")
  fi

  gcloud "${args[@]}"
}

execute_run_job() {
  local job="$1"
  local region="$2"
  require_cmd gcloud
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to execute $job outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  gcloud run jobs execute "$job" --region "$region" --wait
}

service_logs() {
  local service="$1"
  local region="$2"
  local limit="${LOG_LIMIT:-100}"
  require_cmd gcloud
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to read $service logs outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  gcloud run services logs read "$service" --region "$region" --limit "$limit"
}

job_logs() {
  local job="$1"
  local region="$2"
  local limit="${LOG_LIMIT:-100}"
  require_cmd gcloud
  if [ "$region" != "$EXPECTED_REGION" ]; then
    echo "Refusing to read $job logs outside $EXPECTED_REGION (got: $region)." >&2
    exit 1
  fi
  gcloud run jobs logs read "$job" --region "$region" --limit "$limit"
}

run_local_node() {
  local dir="$1"
  (cd "$dir" && { if [ "${INSTALL_DEPS:-false}" = "true" ]; then npm install; fi; npm run start; })
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
  else
    echo "docker compose"
  fi
}
