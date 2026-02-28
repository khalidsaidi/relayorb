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
5. Observability smoke:
   - `curl http://127.0.0.1:8080/metrics | head`
   - `curl http://127.0.0.1:8081/metrics | head`
   - `curl http://127.0.0.1:8090/metrics | head`
   - If running in bearer mode: `curl -H "Authorization: Bearer <token>" http://127.0.0.1:8080/metrics | head`

## Deploy (Cloud Run)

1. Ensure project/services exist (`relayorb-prod`, Artifact Registry, service accounts).
2. Use service names in format `relayorb-<component>-<env>`:
   - `relayorb-gateway-prod`
   - `relayorb-registry-prod`
   - `relayorb-rag-prod`
3. Create env-scoped secrets in Secret Manager:
   - `relayorb-prod-gateway-db`
   - `relayorb-prod-registry-db`
   - `relayorb-prod-gateway-metrics-token`
   - `relayorb-prod-registry-metrics-token`
   - `godaddy-api-key`
   - `godaddy-api-secret`
4. For gateway OIDC auth, configure:
   - `AUTH_MODE=oidc`
   - `OIDC_ISSUER`
   - `OIDC_AUDIENCE`
   - `JWKS_URL`
   - `AUTH_CLOCK_SKEW_SECONDS` (recommended `120`)
   - Emergency-only fallback: if running HMAC in prod, set `ALLOW_HMAC_IN_PROD=true` explicitly.
5. For identity-bound registry governance (recommended), configure registry worker auth:
   - `REGISTRY_WORKER_AUTH_MODE=oidc`
   - `REGISTRY_WORKER_OIDC_AUDIENCE=<registry-url>`
   - optional overrides: `REGISTRY_WORKER_OIDC_ISSUER`, `REGISTRY_WORKER_JWKS_URL`
   - workers must set `REGISTRY_IDENTITY_AUDIENCE=<registry-url>` so registration/heartbeat include service identity tokens.
6. Push to `main` or run deploy workflows manually:
   - `.github/workflows/deploy-registry.yml`
   - `.github/workflows/deploy-gateway.yml`
   - Registry deploy workflow runs `ops/smoke/registry-governance-smoke.sh` post-deploy and fails if governance checks regress.
   - Gateway and registry deploy workflows run `ops/smoke/metrics-auth-smoke.sh` post-deploy and fail if `/metrics` auth regresses.
7. Confirm services:
   - `gcloud run services list --region us-central1`
8. Apply/refresh alert policies:
   - `cd infra/gcp/terraform`
   - `terraform init`
   - `terraform apply`
   - Confirm policies exist:
     - `relayorb-prod-gateway-error-rate`
     - `relayorb-prod-registry-healthy-providers-zero`
     - `relayorb-prod-gateway-jobs-queued-high`

## Observability in prod

1. Enable OTEL export by setting `OTEL_EXPORTER_OTLP_ENDPOINT` on gateway/registry/worker.
2. Keep `RELAYORB_METRICS_EXPORTER=prometheus` (default) for `/metrics`.
3. In prod, keep `METRICS_AUTH_MODE=bearer` and rotate `METRICS_BEARER_TOKEN` via Secret Manager.
4. Build dashboard charts from:
   - `relayorb_gateway_invoke_latency_ms` (p95 by `capability_id`)
   - `relayorb_gateway_invoke_requests_total` (error rate by `result`/`error_code`)
   - `relayorb_gateway_idempotency_replays_total`
   - `relayorb_gateway_jobs_queued`
   - `relayorb_registry_governance_denials_total`
   - `relayorb_worker_invoke_latency_ms`
5. Alert recommendations:
   - rising `relayorb_gateway_jobs_queued`
   - rising `relayorb_gateway_request_errors_total{error_code=\"NO_HEALTHY_PROVIDERS\"}`
   - rising `relayorb_registry_governance_denials_total` in prod.

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
