# Guardrails: fail apply if invoker IAM checks are disabled on private services.
# Cloud Run IAM bindings are not sufficient if the invoker IAM check is turned off.

data "external" "registry_invoker_iam_check" {
  program = [
    "/bin/bash",
    "-lc",
    "set -euo pipefail; value=$(timeout 20s env CLOUDSDK_CORE_DISABLE_PROMPTS=1 gcloud run services describe '${var.registry_service_name}' --project '${var.project_id}' --region '${var.region}' --quiet --format=\"value(metadata.annotations['run.googleapis.com/invoker-iam-disabled'])\"); value=$${value:-false}; printf '{\"invoker_iam_disabled\":\"%s\"}\\n' \"$value\"",
  ]
}

data "external" "worker_invoker_iam_check" {
  program = [
    "/bin/bash",
    "-lc",
    "set -euo pipefail; value=$(timeout 20s env CLOUDSDK_CORE_DISABLE_PROMPTS=1 gcloud run services describe '${var.worker_service_name}' --project '${var.project_id}' --region '${var.region}' --quiet --format=\"value(metadata.annotations['run.googleapis.com/invoker-iam-disabled'])\"); value=$${value:-false}; printf '{\"invoker_iam_disabled\":\"%s\"}\\n' \"$value\"",
  ]
}

check "private_service_invoker_iam_checks_enabled" {
  assert {
    condition     = lower(data.external.registry_invoker_iam_check.result.invoker_iam_disabled) != "true"
    error_message = "Registry has run.googleapis.com/invoker-iam-disabled=true. Enable Cloud Run invoker IAM checks before apply."
  }

  assert {
    condition     = lower(data.external.worker_invoker_iam_check.result.invoker_iam_disabled) != "true"
    error_message = "Worker has run.googleapis.com/invoker-iam-disabled=true. Enable Cloud Run invoker IAM checks before apply."
  }
}
