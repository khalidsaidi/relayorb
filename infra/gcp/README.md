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
5. Apply monitoring alert policies from Terraform:
   - `relayorb-prod-gateway-error-rate`
   - `relayorb-prod-registry-healthy-providers-zero`
   - `relayorb-prod-gateway-jobs-queued-high`

## Secrets

Store all runtime secrets in Secret Manager:
- `relayorb-prod-gateway-db`
- `relayorb-prod-registry-db`
- `relayorb-prod-gateway-metrics-token`
- `relayorb-prod-registry-metrics-token`
- `relayorb-prod-jwt-config` (optional bundle if you centralize auth config)
- `relayorb-prod-hmac-key` (dev/fallback only)
- `godaddy-api-key`
- `godaddy-api-secret`

## Domain mapping with GoDaddy

Use `infra/gcp/scripts/update_godaddy_dns.sh` to upsert DNS records after Cloud Run domain mapping outputs required CNAME/TXT records.
The script reads GoDaddy credentials from Secret Manager at runtime.

## Alerting notes

- Alert policies are defined in `infra/gcp/terraform/main.tf`.
- Attach notification channels by setting `notification_channels` Terraform variable.
- Gateway error-rate alert uses Cloud Run native request metrics.
- Provider health and queued job alerts use RelayOrb Prometheus metrics (`relayorb_registry_providers_healthy`, `relayorb_gateway_jobs_queued`).
