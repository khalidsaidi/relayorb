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
   - `relayorb-prod-worker-metrics-token`
   - `godaddy-api-key`
   - `godaddy-api-secret`
4. For gateway OIDC auth, configure:
   - `AUTH_MODE=oidc`
   - `OIDC_ISSUER`
   - `OIDC_AUDIENCE`
   - `JWKS_URL`
   - `AUTH_CLOCK_SKEW_SECONDS` (recommended `120`)
   - Emergency-only fallback: if running HMAC in prod, set `ALLOW_HMAC_IN_PROD=true` explicitly.
5. For internal Cloud Run IAM auth, keep:
   - `INTERNAL_IAM_AUTH=on` on gateway in prod.
   - worker `REGISTRY_IDENTITY_AUDIENCE=<registry service run.app URL>`.
   - registry worker auth mode enabled (`REGISTRY_WORKER_AUTH_MODE=oidc`).
6. Service posture:
   - gateway is public (`allUsers` invoker retained intentionally).
   - registry and worker are private (`allUsers` removed; `roles/run.invoker` only for required runtime SAs).
7. Rollout-safe order for first hardening migration:
   - deploy code updates first (gateway, registry, worker, scraper) while old IAM policy still allows traffic.
   - apply Terraform IAM hardening second (remove `allUsers`, enforce service-to-service invokers).
   - run post-apply smokes immediately.
8. For identity-bound registry governance (recommended), configure registry worker auth:
   - `REGISTRY_WORKER_AUTH_MODE=oidc`
   - `REGISTRY_WORKER_OIDC_AUDIENCE=<registry-url>`
   - optional overrides: `REGISTRY_WORKER_OIDC_ISSUER`, `REGISTRY_WORKER_JWKS_URL`
   - workers must set `REGISTRY_IDENTITY_AUDIENCE=<registry-url>` so registration/heartbeat include service identity tokens.
9. Push to `main` or run deploy workflows manually:
   - `.github/workflows/deploy-registry.yml`
   - `.github/workflows/deploy-gateway.yml`
   - `.github/workflows/deploy-metrics-scraper.yml`
   - Registry deploy workflow runs `ops/smoke/registry-governance-smoke.sh` post-deploy and fails if governance checks regress.
   - Registry deploy workflow refreshes `relayorb-rag-prod` with bearer metrics auth and runs worker metrics smoke.
   - For private registry/worker services, metrics smoke accepts unauthenticated `403` at Cloud Run IAM as expected.
   - Metrics scraper workflow deploys `relayorb-metrics-scraper-prod` and keeps one instance scraping metrics continuously.
   - Metrics scraper workflow runs `ops/smoke/metrics-scraper-smoke.sh` (service ready + no recent exporter errors + key series present).
   - Gateway and registry deploy workflows run `ops/smoke/metrics-auth-smoke.sh` post-deploy and fail if `/metrics` auth regresses.
10. Confirm services:
   - `gcloud run services list --region us-central1`
11. Apply/refresh alert policies:
   - `cd infra/gcp/terraform`
   - `terraform init`
   - `terraform apply`
   - Ensure scraper is live first: `gcloud run services describe relayorb-metrics-scraper-prod --region us-central1 --format='value(status.url)'`
   - Provider-health and jobs-queued alerts depend on Prometheus ingestion (`prometheus.googleapis.com/...`) from that scraper.
   - Confirm policies exist:
     - `relayorb-prod-gateway-error-rate`
     - `relayorb-prod-registry-healthy-providers-zero`
     - `relayorb-prod-gateway-jobs-queued-high`
12. IAM drift-proofing:
   - Keep deploy/runtime IAM grants in `infra/gcp/terraform` (`iam.tf`).
   - Run:
     - `cd infra/gcp/terraform`
     - `terraform plan`
     - `terraform apply`
   - `terraform plan/apply` checks `run.googleapis.com/invoker-iam-disabled` for private services via `gcloud run services describe`; ensure GCP auth is active before running.
   - No manual `gcloud ... add-iam-policy-binding` steps should be needed for:
     - metrics scraper deploy workflow
     - worker metrics secret access
     - scraper smoke queries to Logging/Monitoring APIs
      - registry/worker Cloud Run `run.invoker` posture

## Post-hardening verification

1. Verify private registry/worker from an unauthenticated caller:
   - `curl -i https://<registry-url>/health` -> expect `403`
   - `curl -i https://<worker-url>/health` -> expect `403`
2. Verify gateway e2e still routes:
   - call `POST /v1/invoke` with a valid gateway OIDC bearer token and confirm `meta.routedTo` is the worker URL.
3. Verify metrics scraping still works after private lock-down:
   - run `ops/smoke/metrics-scraper-smoke.sh` and confirm each job has `up=1` in Cloud Monitoring.

## Observability in prod

1. Enable OTEL export by setting `OTEL_EXPORTER_OTLP_ENDPOINT` on gateway/registry/worker.
2. Keep `RELAYORB_METRICS_EXPORTER=prometheus` (default) for `/metrics`.
3. In prod/demo, keep `METRICS_AUTH_MODE=bearer` and rotate `METRICS_BEARER_TOKEN` via Secret Manager.
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

## Anonymous demo operations

1. Ensure remote Terraform state is configured for demo:
   - create a GCS bucket for state (versioning on, uniform bucket-level access on)
   - grant the deploy-demo SA `roles/storage.objectAdmin` on that bucket
   - set GitHub secret `GCP_DEMO_TF_STATE_BUCKET=<bucket-name>`
2. Deploy demo stack:
   - run `.github/workflows/deploy-demo.yml`
3. Verify posture and behavior:
   - `bash ops/smoke/demo-deploy-verify.sh`
   - optional strict rate-limit assertion:
     - `CHECK_RATE_LIMIT=1 bash ops/smoke/demo-deploy-verify.sh`
4. Keep demo cost bounded:
   - configure Cloud Billing budget alerts in `relayorb-demo`
   - keep Cloud Run max instances capped
5. Emergency traffic stop (panic button):
   - `gcloud compute security-policies rules update 2147483647 --project relayorb-demo --security-policy relayorb-demo-armor --action deny-403`
6. Restore traffic:
   - `gcloud compute security-policies rules update 2147483647 --project relayorb-demo --security-policy relayorb-demo-armor --action allow`

## Rollback

1. List revisions:
   - `gcloud run revisions list --service relayorb-gateway --region us-central1`
2. Shift traffic back to last known good revision:
   - `gcloud run services update-traffic relayorb-gateway --to-revisions <revision>=100 --region us-central1`
3. Validate health and invoke smoke test.
4. If hardening breaks internal traffic, temporarily restore `allUsers` only long enough to recover and re-run:
   - fix service-to-service IAM audience/invoker bindings,
   - re-apply Terraform to return registry/worker to private posture.
