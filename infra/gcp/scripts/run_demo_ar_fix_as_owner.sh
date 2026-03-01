#!/usr/bin/env bash
set -euo pipefail
export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# ============
# RUN AS OWNER (or IAM admin) IN relayorb-demo
# ============
DEMO_PROJECT_ID="${DEMO_PROJECT_ID:-relayorb-demo}"
AR_LOCATION="${AR_LOCATION:-us-central1}"   # must match the docker host used (e.g., us-central1-docker.pkg.dev)
AR_REPO="${AR_REPO:-relayorb}"              # must match the repo segment in image URLs

# The SA used by deploy-demo.yml (google-github-actions/auth -> service_account:)
# Find it in the repo:
#   rg -n "google-github-actions/auth|service_account:" .github/workflows/deploy-demo.yml
DEMO_GH_DEPLOYER_SA_EMAIL="${DEMO_GH_DEPLOYER_SA_EMAIL:-REPLACE_ME_WITH_DEPLOY_DEMO_SERVICE_ACCOUNT}"
if [ "${DEMO_GH_DEPLOYER_SA_EMAIL}" = "REPLACE_ME_WITH_DEPLOY_DEMO_SERVICE_ACCOUNT" ]; then
  echo "Set DEMO_GH_DEPLOYER_SA_EMAIL before running this script." >&2
  exit 2
fi

# ---- Option A (recommended): owner runs the fix once, no grants to others needed ----
CLOUDSDK_CORE_DISABLE_PROMPTS=1 \
CLOUDSDK_CORE_PROJECT="${DEMO_PROJECT_ID}" \
CLOUDSDK_RUN_REGION="${AR_LOCATION}" \
DEMO_PROJECT_ID="${DEMO_PROJECT_ID}" \
AR_LOCATION="${AR_LOCATION}" \
AR_REPO="${AR_REPO}" \
DEMO_GH_DEPLOYER_SA_EMAIL="${DEMO_GH_DEPLOYER_SA_EMAIL}" \
bash infra/gcp/scripts/fix_demo_artifact_registry_push.sh

echo
echo "Now re-run the GitHub workflow:"
echo '  gh workflow run "Deploy Anonymous Demo" --ref main'

# ---- Option B: if you want shallowlocalclone@gmail.com to run it themselves instead ----
# NOTE: roles/browser is needed so gcloud can read the project (resourcemanager.projects.get).
# USER_EMAIL="shallowlocalclone@gmail.com"
# gcloud projects add-iam-policy-binding "${DEMO_PROJECT_ID}" \
#   --member="user:${USER_EMAIL}" --role="roles/browser" --quiet
# gcloud projects add-iam-policy-binding "${DEMO_PROJECT_ID}" \
#   --member="user:${USER_EMAIL}" --role="roles/artifactregistry.admin" --quiet
# gcloud projects add-iam-policy-binding "${DEMO_PROJECT_ID}" \
#   --member="user:${USER_EMAIL}" --role="roles/serviceusage.serviceUsageAdmin" --quiet
#
# Then USER_EMAIL can run:
#   DEMO_GH_DEPLOYER_SA_EMAIL="..." bash infra/gcp/scripts/fix_demo_artifact_registry_push.sh
