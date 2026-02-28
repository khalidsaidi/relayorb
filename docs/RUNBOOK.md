# RelayOrb Runbook

## Local development

1. Build and run stack:
   - `cd ops`
   - `docker compose up --build`
2. Invoke sample capability:
   - `cargo run -p agent-client -- rag.search@v1 '{"query":"hello","topK":3}'`
3. Check replay artifact:
   - `curl http://127.0.0.1:8080/v1/replay/<request-id>`
4. Async job authz smoke:
   - Submit job as creator, then read `GET /v1/jobs/<job-id>` as creator (expect success).
   - Read the same job as non-creator/non-admin (expect `FORBIDDEN`).
   - Read as admin role (`admin|ops|platform-admin`) (expect success).

## Deploy (Cloud Run)

1. Ensure project/services exist (`relayorb-prod`, Artifact Registry, service accounts).
2. Use service names in format `relayorb-<component>-<env>`:
   - `relayorb-gateway-prod`
   - `relayorb-registry-prod`
   - `relayorb-rag-prod`
3. Create env-scoped secrets in Secret Manager:
   - `relayorb-prod-gateway-db`
   - `relayorb-prod-registry-db`
   - `godaddy-api-key`
   - `godaddy-api-secret`
4. For gateway OIDC auth, configure:
   - `AUTH_MODE=oidc`
   - `OIDC_ISSUER`
   - `OIDC_AUDIENCE`
   - `JWKS_URL`
   - `AUTH_CLOCK_SKEW_SECONDS` (recommended `120`)
   - Emergency-only fallback: if running HMAC in prod, set `ALLOW_HMAC_IN_PROD=true` explicitly.
5. Push to `main` or run deploy workflows manually:
   - `.github/workflows/deploy-registry.yml`
   - `.github/workflows/deploy-gateway.yml`
   - Registry deploy workflow runs `ops/smoke/registry-governance-smoke.sh` post-deploy and fails if governance checks regress.
6. Confirm services:
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
