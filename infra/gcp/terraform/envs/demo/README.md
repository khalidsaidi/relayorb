# RelayOrb Demo Terraform Stack

This stack provisions an anonymous public demo environment with strict blast-radius controls:

- Public entrypoint: `relayorb-gateway-demo` behind External HTTP(S) Load Balancer + Cloud Armor.
- Private control plane/services: `relayorb-registry-demo`, `relayorb-rag-demo`, `relayorb-metrics-scraper-demo`.
- Cloud Run IAM service-to-service access between gateway/registry/worker/scraper.
- Demo-only limits: low instance caps, request/timeout/rate limits, read-only capability allowlist.

## Deploy

1. Prepare secrets in Secret Manager (no secrets in git):
   - `relayorb-demo-gateway-metrics-token`
   - `relayorb-demo-registry-metrics-token`
   - `relayorb-demo-worker-metrics-token`
2. Build and push container images, then set image refs in `terraform.tfvars`.
3. Apply:

```bash
cd infra/gcp/terraform/envs/demo
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform apply
```

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
