data "google_project" "current" {
  project_id = var.project_id
}

locals {
  default_compute_sa_member = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

# The default compute service account is a generic identity and must never
# receive broad project IAM in prod. This check makes that negative state part
# of the Terraform contract and fails plan/apply if it reappears out-of-band.
data "external" "default_compute_sa_project_editor_check" {
  program = [
    "/bin/bash",
    "-lc",
    "set -euo pipefail; member='${local.default_compute_sa_member}'; present=false; if timeout 20s env CLOUDSDK_CORE_DISABLE_PROMPTS=1 gcloud projects get-iam-policy '${var.project_id}' --format=json | jq -e --arg member \"$member\" 'any(.bindings[]?; .role == \"roles/editor\" and any(.members[]?; . == $member))' >/dev/null; then present=true; fi; printf '{\"present\":\"%s\"}\\n' \"$present\"",
  ]
}

check "default_compute_sa_overpermissioned_grants_absent" {
  assert {
    condition     = lower(data.external.default_compute_sa_project_editor_check.result.present) != "true"
    error_message = "Default compute service account still has roles/editor on the project. Remove the shadow grant before apply."
  }
}
