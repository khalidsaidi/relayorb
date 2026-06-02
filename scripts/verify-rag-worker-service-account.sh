#!/usr/bin/env bash
set -euo pipefail

WORKFLOW=".github/workflows/deploy-registry.yml"
EXPECTED_SA='relayorb-rag-sa@${{ env.PROJECT_ID }}.iam.gserviceaccount.com'

if ! grep -Fq -- "--service-account ${EXPECTED_SA}" "$WORKFLOW"; then
  echo "missing explicit rag worker service account in $WORKFLOW"
  exit 1
fi

if ! grep -Fq -- "[ \"\$WORKER_SA\" = \"${EXPECTED_SA}\" ]" "$WORKFLOW"; then
  echo "missing exact worker service account verification in $WORKFLOW"
  exit 1
fi

echo "rag worker service-account guard verified"
