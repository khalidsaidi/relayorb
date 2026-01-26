#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=./_common.sh
source "$SCRIPT_DIR/_common.sh"

METRIC_NAME=${METRIC_NAME:-relayorb_auth_errors}
POLICY_NAME=${POLICY_NAME:-relayorb-auth-errors}
ALERT_DISPLAY_NAME=${ALERT_DISPLAY_NAME:-"RelayOrb Auth Errors (401/402/403)"}
ALERT_DURATION=${ALERT_DURATION:-"60s"}
ALERT_ALIGNMENT=${ALERT_ALIGNMENT:-"60s"}
ALERT_ENABLED=${ALERT_ENABLED:-true}
NOTIFICATION_CHANNELS=${NOTIFICATION_CHANNELS:-}

usage() {
  cat <<USAGE
Usage: $(basename "$0") <command>

Commands:
  create   Create/update log-based metric + alert policy
  delete   Delete log-based metric + alert policy
  status   Show current metric + policy status

Env:
  METRIC_NAME            Log-based metric name (default: relayorb_auth_errors)
  POLICY_NAME            Alert policy display name (default: relayorb-auth-errors)
  NOTIFICATION_CHANNELS  Comma-separated channel IDs (optional)
USAGE
}

command=${1:-}
project=$(require_project_id)

metric_filter='(resource.type="cloud_run_revision" OR resource.type="cloud_run_job") AND (httpRequest.status=401 OR httpRequest.status=402 OR httpRequest.status=403 OR textPayload:"Request failed 401" OR textPayload:"Request failed 402" OR textPayload:"Request failed 403" OR textPayload:"Unauthorized" OR textPayload:"unauthorized" OR textPayload:"Forbidden" OR textPayload:"forbidden")'

metric_exists() {
  gcloud logging metrics list --project "$project" --format="value(name)" \
    | rg -x "$METRIC_NAME"
}

policy_exists() {
  gcloud monitoring policies list --project "$project" --format="value(displayName)" \
    | rg -x "$POLICY_NAME"
}

create_metric() {
  if metric_exists >/dev/null 2>&1; then
    echo "Metric $METRIC_NAME already exists."
    return
  fi
  gcloud logging metrics create "$METRIC_NAME" \
    --project "$project" \
    --description "RelayOrb auth errors (401/402/403) from Cloud Run services/jobs" \
    --log-filter "$metric_filter"
  echo "Created metric $METRIC_NAME."
}

delete_metric() {
  if ! metric_exists >/dev/null 2>&1; then
    echo "Metric $METRIC_NAME not found."
    return
  fi
  gcloud logging metrics delete "$METRIC_NAME" --project "$project" --quiet
  echo "Deleted metric $METRIC_NAME."
}

create_policy() {
  if policy_exists >/dev/null 2>&1; then
    echo "Policy $POLICY_NAME already exists."
    return
  fi

  local channels_json="[]"
  if [ -n "$NOTIFICATION_CHANNELS" ]; then
    local IFS=','; read -ra ids <<< "$NOTIFICATION_CHANNELS"
    local list=""
    for id in "${ids[@]}"; do
      id=$(echo "$id" | xargs)
      if [ -n "$id" ]; then
        list="${list}\"projects/${project}/notificationChannels/${id}\","
      fi
    done
    channels_json="[${list%,}]"
  fi

  local tmpfile
  tmpfile=$(mktemp)
  local filter_escaped
  filter_escaped=${metric_filter//\"/\\\"}
  cat >"$tmpfile" <<JSON
{
  "displayName": "${POLICY_NAME}",
  "combiner": "OR",
  "enabled": ${ALERT_ENABLED},
  "alertStrategy": {
    "notificationRateLimit": { "period": "300s" }
  },
  "conditions": [
    {
      "displayName": "${ALERT_DISPLAY_NAME}",
      "conditionMatchedLog": {
        "filter": "${filter_escaped}"
      }
    }
  ],
  "notificationChannels": ${channels_json}
}
JSON

  gcloud monitoring policies create --project "$project" --policy-from-file="$tmpfile"
  rm -f "$tmpfile"
  echo "Created alert policy $POLICY_NAME."
}

delete_policy() {
  local policy_id
  policy_id=$(gcloud monitoring policies list --project "$project" \
    --filter="displayName=${POLICY_NAME}" --format="value(name)")
  if [ -z "$policy_id" ]; then
    echo "Policy $POLICY_NAME not found."
    return
  fi
  gcloud monitoring policies delete "$policy_id" --project "$project" --quiet
  echo "Deleted policy $POLICY_NAME."
}

status() {
  echo "Project: $project"
  echo "Metric: ${METRIC_NAME}"
  if metric_exists >/dev/null 2>&1; then
    echo "  metric exists"
  else
    echo "  metric missing"
  fi
  echo "Policy: ${POLICY_NAME}"
  if policy_exists >/dev/null 2>&1; then
    echo "  policy exists"
  else
    echo "  policy missing"
  fi
}

case "$command" in
  create)
    create_metric
    create_policy
    ;;
  delete)
    delete_policy
    delete_metric
    ;;
  status)
    status
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "Unknown command: $command" >&2
    usage
    exit 1
    ;;
esac
