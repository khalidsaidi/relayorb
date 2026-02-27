# RelayOrb GCP deployment

This folder contains Terraform scaffolding, deployment scripts, and DNS automation helpers.

## Quick setup

1. Select project and region:
   - `gcloud config set project relayorb-prod`
   - `gcloud config set run/region us-central1`
2. Enable required APIs:
   - `run.googleapis.com`
   - `artifactregistry.googleapis.com`
   - `secretmanager.googleapis.com`
   - `cloudbuild.googleapis.com`
   - `iam.googleapis.com`
3. Apply Terraform in `infra/gcp/terraform`.
4. Use GitHub Actions OIDC deploy workflows.

## Secrets

Store all runtime secrets in Secret Manager:
- `relayorb-auth-hmac`
- `relayorb-jwt-public-keys-url`
- `database-url`
- `godaddy-api-key`
- `godaddy-api-secret`

## Domain mapping with GoDaddy

Use `infra/gcp/scripts/update_godaddy_dns.sh` to upsert DNS records after Cloud Run domain mapping outputs required CNAME/TXT records.
The script reads GoDaddy credentials from Secret Manager at runtime.
