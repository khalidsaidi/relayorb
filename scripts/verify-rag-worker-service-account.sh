#!/usr/bin/env bash
set -euo pipefail

WORKFLOW=".github/workflows/deploy-registry.yml"
DEMO_TERRAFORM="infra/gcp/terraform/envs/demo/main.tf"
REFERENCE_VARIABLES="infra/gcp/terraform/variables.tf"
EXPECTED_SA='relayorb-rag-sa@${{ env.PROJECT_ID }}.iam.gserviceaccount.com'
EXPECTED_TERRAFORM_SA='service_account                  = local.worker_sa_email'
EXPECTED_WORKER_SA_ID='default     = "relayorb-rag-sa"'

worker_block="$(
  awk '
    /resource "google_cloud_run_v2_service" "worker"/ { in_block=1 }
    in_block { print }
    in_block && /^}/ { exit }
  ' "$DEMO_TERRAFORM"
)"

if ! grep -Fq -- "--service-account ${EXPECTED_SA}" "$WORKFLOW"; then
  echo "missing explicit rag worker service account in $WORKFLOW"
  exit 1
fi

if ! grep -Fq -- "[ \"\$WORKER_SA\" = \"${EXPECTED_SA}\" ]" "$WORKFLOW"; then
  echo "missing exact worker service account verification in $WORKFLOW"
  exit 1
fi

if ! grep -Fq -- "$EXPECTED_TERRAFORM_SA" <<<"$worker_block"; then
  echo "missing explicit worker service account in $DEMO_TERRAFORM"
  exit 1
fi

if ! grep -Fq -- "$EXPECTED_WORKER_SA_ID" "$REFERENCE_VARIABLES"; then
  echo "missing relayorb-rag-sa default in $REFERENCE_VARIABLES"
  exit 1
fi

echo "rag worker service-account guard verified"
