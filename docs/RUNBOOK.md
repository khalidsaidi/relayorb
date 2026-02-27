# RelayOrb Runbook

## Local development

1. Build and run stack:
   - `cd ops`
   - `docker compose up --build`
2. Invoke sample capability:
   - `cargo run -p agent-client -- rag.search@v1 '{"query":"hello","topK":3}'`
3. Check replay artifact:
   - `curl http://127.0.0.1:8080/v1/replay/<request-id>`

## Deploy (Cloud Run)

1. Ensure project/services exist (`relayorb-prod`, Artifact Registry, service accounts).
2. Push to `main` or run deploy workflows manually:
   - `.github/workflows/deploy-registry.yml`
   - `.github/workflows/deploy-gateway.yml`
3. Confirm services:
   - `gcloud run services list --region us-central1`

## Domain setup (GoDaddy)

1. Create Cloud Run domain mappings for:
   - `api.<domain>` -> gateway
   - `registry.<domain>` -> registry
2. Apply required DNS records with:
   - `infra/gcp/scripts/update_godaddy_dns.sh <domain> <host> <type> <value> [ttl]`
3. Verify certificate provisioning:
   - `gcloud run domain-mappings describe ...`

## Rollback

1. List revisions:
   - `gcloud run revisions list --service relayorb-gateway --region us-central1`
2. Shift traffic back to last known good revision:
   - `gcloud run services update-traffic relayorb-gateway --to-revisions <revision>=100 --region us-central1`
3. Validate health and invoke smoke test.
