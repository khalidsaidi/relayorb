#!/usr/bin/env bash
set -euo pipefail

export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# Fix: GitHub Actions cannot push demo images to Artifact Registry
# Symptom: denied: Permission "artifactregistry.repositories.uploadArtifacts" denied ...
# Root cause: the SA used by deploy-demo.yml lacks roles/artifactregistry.writer on the target repo.
# Note: roles/artifactregistry.writer includes artifactregistry.repositories.uploadArtifacts.

########################################
# REQUIRED INPUTS (set these)
########################################
DEMO_PROJECT_ID="${DEMO_PROJECT_ID:-relayorb-demo}"

# IMPORTANT: This must match the Artifact Registry repo LOCATION you push to:
# - If your image host is us-central1-docker.pkg.dev -> location is us-central1
# - If your image host is us-docker.pkg.dev -> location is us (multi-region)
AR_LOCATION="${AR_LOCATION:-us-central1}"

# The Artifact Registry DOCKER repository name (the segment after /<project>/)
# Example image: us-central1-docker.pkg.dev/relayorb-demo/relayorb/demo-gateway:sha-...
# Repo name there is "relayorb"
AR_REPO="${AR_REPO:-relayorb}"

# The service account that GitHub Actions impersonates in deploy-demo.yml
# (This is the email value in your GH secret used by google-github-actions/auth@v2)
# Example: relayorb-demo-github-deployer@relayorb-demo.iam.gserviceaccount.com
DEPLOYER_SA_EMAIL="${DEPLOYER_SA_EMAIL:?Set to the demo deployer service account email used by deploy-demo.yml}"

########################################
# 0) Sanity: ensure Artifact Registry API enabled
########################################
gcloud services enable artifactregistry.googleapis.com --project "${DEMO_PROJECT_ID}" --quiet >/dev/null

########################################
# 1) Ensure the repo exists (create if missing)
########################################
if ! gcloud artifacts repositories describe "${AR_REPO}" \
  --project "${DEMO_PROJECT_ID}" \
  --location "${AR_LOCATION}" >/dev/null 2>&1
then
  echo "Artifact Registry repo ${AR_REPO} not found in ${AR_LOCATION}; creating it..."
  gcloud artifacts repositories create "${AR_REPO}" \
    --project "${DEMO_PROJECT_ID}" \
    --location "${AR_LOCATION}" \
    --repository-format docker \
    --description "RelayOrb demo images" \
    --quiet
fi

########################################
# 2) Grant writer on the repo (repository-scoped; least privilege)
########################################
echo "Granting roles/artifactregistry.writer to ${DEPLOYER_SA_EMAIL} on ${AR_REPO}..."
gcloud artifacts repositories add-iam-policy-binding "${AR_REPO}" \
  --project "${DEMO_PROJECT_ID}" \
  --location "${AR_LOCATION}" \
  --member "serviceAccount:${DEPLOYER_SA_EMAIL}" \
  --role "roles/artifactregistry.writer" \
  --quiet >/dev/null

########################################
# 3) Verify binding present
########################################
echo "Verifying IAM binding..."
POLICY_JSON="$(gcloud artifacts repositories get-iam-policy "${AR_REPO}" \
  --project "${DEMO_PROJECT_ID}" \
  --location "${AR_LOCATION}" \
  --format=json)"

echo "${POLICY_JSON}" | jq -e --arg sa "serviceAccount:${DEPLOYER_SA_EMAIL}" '
  any(.bindings[]?; .role=="roles/artifactregistry.writer" and any(.members[]?; .==$sa))
' >/dev/null

echo "OK: ${DEPLOYER_SA_EMAIL} can push to ${AR_LOCATION}-docker.pkg.dev/${DEMO_PROJECT_ID}/${AR_REPO}"
echo
echo "NEXT: re-run the Deploy Anonymous Demo workflow (deploy-demo.yml)."
echo "If it still fails, see triage hints printed below."
echo

########################################
# 4) Triage hints if it STILL fails
########################################
cat <<'TXT'
If push still fails with uploadArtifacts denied, 99% of the time it's one of these:

A) WRONG LOCATION/HOST MISMATCH
   - If your workflow pushes to us-central1-docker.pkg.dev, the repo must be in us-central1.
   - If the repo is in "us" (multi-region), push host must be us-docker.pkg.dev.
   Check:
     gcloud artifacts repositories describe <repo> --location <loc> --format='value(name)'

B) WORKFLOW IS IMPERSONATING A DIFFERENT SA THAN YOU FIXED
   Add a temporary debug step in deploy-demo.yml *before* docker push:
     gcloud auth list
     gcloud config list account
   Ensure the active account == the DEPLOYER_SA_EMAIL you granted.

C) PUSHING TO THE WRONG PROJECT
   Confirm image tags use the correct project:
     ...docker.pkg.dev/relayorb-demo/<repo>/...
TXT
