# RelayOrb Demo Terraform Stack

This stack provisions an anonymous public demo environment with strict blast-radius controls:

- Public entrypoint: `relayorb-gateway-demo` behind External HTTP(S) Load Balancer + Cloud Armor.
- Private control plane/services: `relayorb-registry-demo`, `relayorb-rag-demo`, `relayorb-metrics-scraper-demo`.
- Cloud Run IAM service-to-service access between gateway/registry/worker/scraper.
- Demo-only limits: low instance caps, request/timeout/rate limits, read-only capability allowlist.

## Deploy

1. Create a remote Terraform state bucket (one-time):
   - `gcloud storage buckets create gs://<demo-tfstate-bucket> --project <PROJECT_ID> --location US --uniform-bucket-level-access`
   - `gcloud storage buckets update gs://<demo-tfstate-bucket> --versioning`
   - `gcloud storage buckets add-iam-policy-binding gs://<demo-tfstate-bucket> --member serviceAccount:<DEPLOY_SA_EMAIL> --role roles/storage.objectAdmin`
2. Prepare secrets in Secret Manager (no secrets in git):
   - `relayorb-demo-gateway-metrics-token`
   - `relayorb-demo-registry-metrics-token`
   - `relayorb-demo-worker-metrics-token`
3. Build and push container images, then set image refs in `terraform.tfvars`.
4. Apply:

```bash
cd infra/gcp/terraform/envs/demo
cp terraform.tfvars.example terraform.tfvars
terraform init -input=false \
  -backend-config="bucket=<demo-tfstate-bucket>" \
  -backend-config="prefix=relayorb/demo"
terraform apply
```

For GitHub Actions, set repository secret `GCP_DEMO_TF_STATE_BUCKET=<demo-tfstate-bucket>`.

## Outputs

- `demo_http_url` (immediate test URL via LB IP)
- `demo_https_url` (when `demo_domain_name` is configured and SSL is provisioned)
- direct Cloud Run service URLs for private-smoke verification

## Emergency block (panic button)

Use Cloud Armor to block all demo traffic without redeploying services:

```bash
gcloud compute security-policies rules update 2147483647 \
  --project <PROJECT_ID> \
  --security-policy relayorb-demo-armor \
  --action "deny-403"
```

Restore normal behavior by changing the rule back to allow:

```bash
gcloud compute security-policies rules update 2147483647 \
  --project <PROJECT_ID> \
  --security-policy relayorb-demo-armor \
  --action "allow"
```
