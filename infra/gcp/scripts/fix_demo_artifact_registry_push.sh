#!/usr/bin/env bash
set -euo pipefail

# =========================
# FIX relayorb-demo AR PUSH
# =========================
# Problem:
#   Deploy Anonymous Demo fails pushing images:
#     Permission "artifactregistry.repositories.uploadArtifacts" denied
#   The repository fix script is correct, but the current identity may not access relayorb-demo.
#
# Meaning:
#   Run as a principal with relayorb-demo access, or have a relayorb-demo owner run it.

DEMO_PROJECT_ID="${DEMO_PROJECT_ID:-relayorb-demo}"
AR_LOCATION="${AR_LOCATION:-us-central1}"
AR_REPO="${AR_REPO:-relayorb}"

echo "== Who am I (active gcloud account)? =="
ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
echo "ACTIVE_ACCOUNT=${ACTIVE_ACCOUNT}"

echo
echo "== Can current identity SEE the demo project? =="
if gcloud projects describe "${DEMO_PROJECT_ID}" --format='value(projectId)' >/dev/null 2>&1; then
  echo "OK: current identity can access ${DEMO_PROJECT_ID}"
else
  echo "BLOCKED: current identity cannot access ${DEMO_PROJECT_ID}"
  echo
  echo "You need one of the following:"
  echo
  echo "Option A:"
  echo "  Ask a relayorb-demo Project Owner to run the fix script once."
  echo
  echo "Option B:"
  echo "  Ask a relayorb-demo Project Owner to grant ${ACTIVE_ACCOUNT}:"
  echo "  - roles/artifactregistry.admin"
  echo "  - roles/serviceusage.serviceUsageAdmin"
  echo
  echo "Owner commands:"
  echo "  gcloud projects add-iam-policy-binding ${DEMO_PROJECT_ID} \\"
  echo "    --member user:${ACTIVE_ACCOUNT} --role roles/artifactregistry.admin"
  echo "  gcloud projects add-iam-policy-binding ${DEMO_PROJECT_ID} \\"
  echo "    --member user:${ACTIVE_ACCOUNT} --role roles/serviceusage.serviceUsageAdmin"
  echo
  exit 2
fi

echo
echo "== IMPORTANT: pick the RIGHT GitHub deployer service account =="
echo "This must be the SA that deploy-demo.yml impersonates."
echo
DEMO_GH_DEPLOYER_SA_EMAIL="${DEMO_GH_DEPLOYER_SA_EMAIL:?Set DEMO_GH_DEPLOYER_SA_EMAIL to the SA used by deploy-demo.yml}"

echo "DEMO_GH_DEPLOYER_SA_EMAIL=${DEMO_GH_DEPLOYER_SA_EMAIL}"
echo

echo "== Grant Artifact Registry writer on demo repo =="
CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
DEMO_PROJECT_ID="${DEMO_PROJECT_ID}" \
AR_LOCATION="${AR_LOCATION}" \
AR_REPO="${AR_REPO}" \
DEPLOYER_SA_EMAIL="${DEMO_GH_DEPLOYER_SA_EMAIL}" \
bash infra/gcp/scripts/fix_demo_artifact_registry_writer.sh

echo
echo "== Re-run the Deploy Anonymous Demo workflow =="
echo "gh workflow run \"Deploy Anonymous Demo\" --ref main"
