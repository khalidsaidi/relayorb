#!/usr/bin/env bash
set -euo pipefail

# ==========================================
# SELF-SERVE DEMO PROJECT BOOTSTRAP (1 person)
# ==========================================
# Use when:
#   - demo deploy fails pushing images (uploadArtifacts denied)
#   - and/or you can't access the intended demo project ("project not found or permission denied")
#
# What it does:
#   - Ensures you have a demo GCP project you OWN
#   - Links billing
#   - Enables APIs needed for Cloud Run + Artifact Registry + LB/Cloud Armor
#   - Ensures Artifact Registry repo exists
#   - Grants the deploy-demo SA repo-scoped roles/artifactregistry.writer (fixes uploadArtifacts)
#
# Requirements:
#   - You must have permission to create projects + link billing in your GCP account
#   - Or you must manually create/link billing in Console if gcloud can't
#
# IMPORTANT:
#   - If "relayorb-demo" is not yours (ID taken), this will create relayorb-demo-<suffix>.
#   - You MUST then update Terraform/workflows/secrets to use the new project id.

export CLOUDSDK_CORE_DISABLE_PROMPTS=1

# ----------------------------
# CONFIG (set these)
# ----------------------------
DESIRED_PROJECT_ID="${DESIRED_PROJECT_ID:-relayorb-demo}"
DEMO_REGION="${DEMO_REGION:-us-central1}"
AR_LOCATION="${AR_LOCATION:-us-central1}"   # must match your docker host, e.g. us-central1-docker.pkg.dev
AR_REPO="${AR_REPO:-relayorb}"

# The SA impersonated by deploy-demo.yml (google-github-actions/auth -> service_account:)
# This can be in relayorb-prod OR in the demo project; either is fine.
DEMO_GH_DEPLOYER_SA_EMAIL="${DEMO_GH_DEPLOYER_SA_EMAIL:?Set DEMO_GH_DEPLOYER_SA_EMAIL to the SA used by deploy-demo.yml}"

# Billing account to link the demo project to.
# If you leave it empty, the script will try to auto-pick the first billing account it can see.
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"

# If you want the fast/no-chasing path and accept broader permissions for the GH deployer SA in the demo project,
# set GRANT_EDITOR_TO_GH_SA=1 (optional). Otherwise we only grant AR writer on the repo here.
GRANT_EDITOR_TO_GH_SA="${GRANT_EDITOR_TO_GH_SA:-0}"

# ----------------------------
# Helpers
# ----------------------------
fail() { echo "ERROR: $*" >&2; exit 1; }

echo "== Active gcloud account =="
ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' || true)"
echo "ACTIVE_ACCOUNT=${ACTIVE_ACCOUNT}"
[[ -n "${ACTIVE_ACCOUNT}" ]] || fail "No active gcloud account. Run: gcloud auth login"

echo
echo "== Step 1: Determine demo project id (accessible or create one) =="

DEMO_PROJECT_ID="${DESIRED_PROJECT_ID}"

if gcloud projects describe "${DEMO_PROJECT_ID}" --format='value(projectId)' --quiet >/dev/null 2>&1; then
  echo "OK: You already have access to project ${DEMO_PROJECT_ID}"
else
  echo "No access to ${DEMO_PROJECT_ID}. Attempting to CREATE it..."

  # Try creating the desired ID
  if gcloud projects create "${DEMO_PROJECT_ID}" --name="RelayOrb Demo" --quiet >/dev/null 2>&1; then
    echo "Created project ${DEMO_PROJECT_ID}"
  else
    echo "Could not create ${DEMO_PROJECT_ID} (either ID is taken or you can't create projects)."

    # If you can create projects but the ID is taken, create a unique fallback
    SUFFIX="$(date +%y%m%d)-$RANDOM"
    DEMO_PROJECT_ID="${DESIRED_PROJECT_ID}-${SUFFIX}"
    echo "Trying fallback project id: ${DEMO_PROJECT_ID}"

    if gcloud projects create "${DEMO_PROJECT_ID}" --name="RelayOrb Demo" --quiet >/dev/null 2>&1; then
      echo "Created project ${DEMO_PROJECT_ID}"
    else
      fail "Still cannot create a demo project via gcloud.
Either: (a) your account/org blocks project creation, or (b) billing/org setup needed.
Create a new project manually in Cloud Console, then rerun this script with DESIRED_PROJECT_ID=<that id>."
    fi
  fi
fi

echo
echo "DEMO_PROJECT_ID=${DEMO_PROJECT_ID}"
echo "DEMO_REGION=${DEMO_REGION}"
echo "AR_LOCATION=${AR_LOCATION}"
echo "AR_REPO=${AR_REPO}"
echo "DEMO_GH_DEPLOYER_SA_EMAIL=${DEMO_GH_DEPLOYER_SA_EMAIL}"

echo
echo "== Step 2: Link billing (required for Cloud Run/LB/Armor) =="

if [[ -z "${BILLING_ACCOUNT_ID}" ]]; then
  echo "BILLING_ACCOUNT_ID not set; attempting to auto-detect first billing account..."
  BILLING_ACCOUNT_ID="$(gcloud beta billing accounts list --format='value(name)' --quiet | head -n1 || true)"
fi

if [[ -z "${BILLING_ACCOUNT_ID}" ]]; then
  fail "No billing accounts visible to this identity.
You must create/link a billing account in Cloud Console, then set BILLING_ACCOUNT_ID and rerun."
fi

echo "Using BILLING_ACCOUNT_ID=${BILLING_ACCOUNT_ID}"
gcloud beta billing projects link "${DEMO_PROJECT_ID}" --billing-account "${BILLING_ACCOUNT_ID}" --quiet || \
  fail "Failed to link billing. Fix billing permissions in Cloud Console and rerun."

echo
echo "== Step 3: Enable required APIs =="

# These cover Cloud Run, Artifact Registry, and common LB/Armor dependencies.
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  compute.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  --project "${DEMO_PROJECT_ID}" \
  --quiet

echo
echo "== Step 4: Ensure Artifact Registry docker repo exists =="

if ! gcloud artifacts repositories describe "${AR_REPO}" \
  --project "${DEMO_PROJECT_ID}" \
  --location "${AR_LOCATION}" \
  --quiet >/dev/null 2>&1
then
  gcloud artifacts repositories create "${AR_REPO}" \
    --project "${DEMO_PROJECT_ID}" \
    --location "${AR_LOCATION}" \
    --repository-format docker \
    --description "RelayOrb demo images" \
    --quiet
  echo "Created AR repo ${AR_REPO}"
else
  echo "AR repo ${AR_REPO} already exists"
fi

echo
echo "== Step 5: Grant repo-scoped Artifact Registry writer to the deploy-demo SA =="

gcloud artifacts repositories add-iam-policy-binding "${AR_REPO}" \
  --project "${DEMO_PROJECT_ID}" \
  --location "${AR_LOCATION}" \
  --member "serviceAccount:${DEMO_GH_DEPLOYER_SA_EMAIL}" \
  --role "roles/artifactregistry.writer" \
  --quiet

echo "Granted roles/artifactregistry.writer on ${AR_REPO} to ${DEMO_GH_DEPLOYER_SA_EMAIL}"

echo
echo "== Optional: grant Editor to GH deployer SA (only if your deploy-demo workflow applies Terraform / creates infra) =="
if [[ "${GRANT_EDITOR_TO_GH_SA}" == "1" ]]; then
  gcloud projects add-iam-policy-binding "${DEMO_PROJECT_ID}" \
    --member "serviceAccount:${DEMO_GH_DEPLOYER_SA_EMAIL}" \
    --role "roles/editor" \
    --quiet
  echo "Granted roles/editor on project to ${DEMO_GH_DEPLOYER_SA_EMAIL}"
else
  echo "Skipping roles/editor grant (GRANT_EDITOR_TO_GH_SA=0)."
  echo "If Deploy Anonymous Demo fails later on permission errors creating LB/Cloud Armor/IAM/etc,"
  echo "either: (a) run Terraform apply as your user, or (b) rerun with GRANT_EDITOR_TO_GH_SA=1."
fi

echo
echo "== Step 6: IMPORTANT — update your repo config if project id changed =="

if [[ "${DEMO_PROJECT_ID}" != "${DESIRED_PROJECT_ID}" ]]; then
  echo "You could NOT use ${DESIRED_PROJECT_ID}; created ${DEMO_PROJECT_ID} instead."
  echo
  echo "Do ALL of the following:"
  echo "  1) Update Terraform demo env var/tfvars to project_id=${DEMO_PROJECT_ID}"
  echo "  2) Update any GitHub secrets/vars used by deploy-demo.yml that reference relayorb-demo"
  echo "  3) Re-run demo deploy"
  echo
  echo "Find references quickly:"
  echo "  rg -n \"${DESIRED_PROJECT_ID}\" -S ."
fi

echo
echo "== Step 7: Run your existing push-fix + deploy =="
echo "Now you should be able to run:"
echo
echo "  DEMO_PROJECT_ID=${DEMO_PROJECT_ID} \\"
echo "  AR_LOCATION=${AR_LOCATION} \\"
echo "  AR_REPO=${AR_REPO} \\"
echo "  DEMO_GH_DEPLOYER_SA_EMAIL=${DEMO_GH_DEPLOYER_SA_EMAIL} \\"
echo "  bash infra/gcp/scripts/fix_demo_artifact_registry_push.sh"
echo
echo "Then re-run the workflow:"
echo "  gh workflow run \"Deploy Anonymous Demo\" --ref main"
