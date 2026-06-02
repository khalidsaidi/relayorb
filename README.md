# RelayOrb

[![Terraform Registry Modules Smoke](https://github.com/khalidsaidi/relayorb/actions/workflows/terraform-registry-modules-smoke.yml/badge.svg)](https://github.com/khalidsaidi/relayorb/actions/workflows/terraform-registry-modules-smoke.yml)

## Website

- Website: https://relayorb.com
- Try demo: https://relayorb.com/demo
- Docs: https://relayorb.com (primary overview) + GitHub docs (canonical runbooks/implementation)
- Production reliability: https://relayorb.com/reliability
- Real-world cost profile: https://relayorb.com/cost_profile.json
- Terraform modules:
  - https://registry.terraform.io/modules/khalidsaidi/relayorb/google/latest
  - https://registry.terraform.io/modules/khalidsaidi/relayorb-demo/google/latest

relayorb.com is the front door; GitHub remains the canonical source of truth for implementation details and runbooks.

GitHub metadata status:
- Homepage URL and discovery topics are configured.
- Social preview image should be managed in GitHub repo settings (use the site OG artwork).

RelayOrb is a capability gateway for AI agents. It enforces auth and policy, routes to healthy workers via a registry, validates schemas end-to-end, and records deterministic invocation artifacts with request-id idempotency and replay.

Gateway also supports asynchronous execution via `POST /v1/submit` and `GET /v1/jobs/:jobId`.

## Production reliability

RelayOrb has been deployed continuously in production since February 2026. The public reliability report publishes 30 days of Cloud Monitoring and Cloud Logging data from the live control plane:

- Reliability report: https://relayorb.com/reliability
- Stats JSON: https://relayorb.com/stats.json

The traffic in that report is synthetic monitoring and control-plane traffic, not public user adoption. External invoke counters remain honest at zero.

## Real-world cost profile

RelayOrb also publishes the live Cloud Run cost lesson from operating the control plane:

- Cost profile JSON: https://relayorb.com/cost_profile.json

The cost profile is modeled from Cloud Monitoring billable instance time and public Cloud Billing SKU prices for `us-central1`. It shows the difference between the previous always-warm deployment and the current `minScale=0` posture.

## Project Surfaces

- Open-source core: runtime, SDK, conformance tooling, and docs in this repository.
- Reference deployment: Terraform and workflows for GCP rollout.
- Demo posture: self-hosted anonymous showcase environment with LB-only access and private internals.

## Demo Posture

RelayOrb includes a demo posture (no login/API key) with strict safety limits for self-hosted evaluation.

The hosted anonymous demo has been retired. To run the same posture yourself:

```bash
export RELAYORB_DEMO_URL="https://YOUR-DEMO-URL"
```

Invoke `rag.search@v1`:

```bash
curl -sS -X POST "$RELAYORB_DEMO_URL/v1/invoke" \
  -H "content-type: application/json" \
  -d '{
    "requestId":"demo-req-1",
    "caller":{"agentId":"anonymous","role":"anonymous"},
    "capability":"rag.search@v1",
    "payload":{"query":"what is relayorb?","topK":3}
  }' | jq
```

Forbidden capability example (expected `403`):

```bash
curl -sS -X POST "$RELAYORB_DEMO_URL/v1/invoke" \
  -H "content-type: application/json" \
  -d '{
    "requestId":"demo-req-forbidden",
    "caller":{"agentId":"anonymous","role":"anonymous"},
    "capability":"sql.query@v1",
    "payload":{"sql":"select 1"}
  }' | jq
```

Demo details and limits: [docs/DEMO.md](/home/khalid/relayorb/docs/DEMO.md)

## Components

- `relayorb-gateway`: invoke entrypoint, policy, routing, artifact recording
- `relayorb-registry`: capability registry + TTL heartbeats
- `relayorb-worker-sdk`: worker server wrapper and heartbeat client
- `relayorb-policy`: RBAC/ABAC-lite rules and budget limiter
- `worker-mock-rag`: sample capability provider (`rag.search@v1`)
- `agent-client`: sample CLI invoker

## Run Locally

1. Start stack:
```bash
cd ops
docker compose up --build
```

Optional: enable zero-cost live search results instead of mock responses:
```bash
cd ops
RAG_LIVE_SEARCH=1 docker compose up --build
```

2. Invoke sample capability:
```bash
cd ..
cargo run -p agent-client -- rag.search@v1 '{"query":"earnings guidance","topK":3}'
```

3. Replay stored invocation:
```bash
curl http://127.0.0.1:8080/v1/replay/<request-id>
```

4. Run one-command local full-surface proof (invoke/replay/submit/jobs/authz/metrics):
```bash
bash ops/smoke/local-full-surface-proof.sh
```

5. Run a business-readable real-world showcase (batch research, async job, RBAC, replay):
```bash
bash ops/smoke/real-world-showcase.sh
```

6. Optional ephemeral cloud demo proof with automatic destroy:
```bash
TF_BACKEND_BUCKET=<demo-tfstate-bucket> \
TF_VARS_FILE=infra/gcp/terraform/envs/demo/terraform.tfvars \
bash ops/smoke/ephemeral-demo-proof.sh
```

## Deploy with Terraform

RelayOrb publishes two Terraform Registry modules:

- Prod-oriented module (OIDC-first): `khalidsaidi/relayorb/google`  
  https://registry.terraform.io/modules/khalidsaidi/relayorb/google/latest
- Anonymous demo module (LB-only gateway posture): `khalidsaidi/relayorb-demo/google`  
  https://registry.terraform.io/modules/khalidsaidi/relayorb-demo/google/latest

Example (prod):

```hcl
module "relayorb" {
  source  = "khalidsaidi/relayorb/google"
  version = "0.1.1"

  project_id     = "relayorb-prod"
  gateway_image  = "ghcr.io/khalidsaidi/relayorb-gateway:v0.1.1"
  registry_image = "ghcr.io/khalidsaidi/relayorb-registry:v0.1.1"
  worker_image   = "ghcr.io/khalidsaidi/relayorb-rag:v0.1.1"
  scraper_image  = "ghcr.io/khalidsaidi/relayorb-metrics-scraper:v0.1.1"
}
```

Example (demo):

```hcl
module "relayorb_demo" {
  source  = "khalidsaidi/relayorb-demo/google"
  version = "0.1.0"

  project_id     = "relayorb-demo"
  gateway_image  = "ghcr.io/khalidsaidi/relayorb-gateway:v0.1.1"
  registry_image = "ghcr.io/khalidsaidi/relayorb-registry:v0.1.1"
  worker_image   = "ghcr.io/khalidsaidi/relayorb-rag:v0.1.1"
  scraper_image  = "ghcr.io/khalidsaidi/relayorb-metrics-scraper:v0.1.1"
}
```

Reference Terraform configs also remain in this repo for direct use/customization:
- Core Terraform: `infra/gcp/terraform/`
- Anonymous demo env: `infra/gcp/terraform/envs/demo/`
- Demo deploy workflow: `.github/workflows/deploy-demo.yml`

For reproducibility with in-repo Terraform, pin to a Git tag/commit before applying.

## Write a Capability Worker

1. Define manifest with `capabilityId`, schemas, limits, and routing hints.
2. Implement `CapabilityHandler` in an SDK-based worker.
3. Register worker capabilities on startup and send heartbeats.
4. Add policy rule allowing target role/capability/sideEffects.

## Verify Conformance

Offline validation:
```bash
cargo run -p relayorb-conformance -- validate \
  --manifest conformance/manifests/rag.search@v1.json \
  --vectors conformance/vectors/rag.search@v1.json
```

Live runtime validation (worker target):
```bash
cargo run -p relayorb-conformance -- run \
  --target worker \
  --base-url http://127.0.0.1:8090 \
  --manifest conformance/manifests/rag.search@v1.json \
  --vectors conformance/vectors/rag.search@v1.json
```

## Configuration

Base config is `config/dev.toml`, overridden by env vars:
- `RELAYORB_ENV`
- `RELAYORB_REGION`
- `RELAYORB_SERVICE_NAME`
- `REGISTRY_URL`
- `DATABASE_URL`
- `AUTH_MODE` (`hmac` or `oidc`)
- `ALLOW_HMAC_IN_PROD` (`true` required to permit HMAC when `RELAYORB_ENV=prod`)
- `SECRET_AUTH_HMAC` (dev / explicit hmac mode)
- `OIDC_ISSUER` (prod oidc mode)
- `OIDC_AUDIENCE` (prod oidc mode)
- `JWKS_URL` (prod oidc mode)
- `AUTH_CLOCK_SKEW_SECONDS` (optional, default `120`)
- `JWKS_REFRESH_INTERVAL_SECONDS` (optional, default `300`)
- `INTERNAL_IAM_AUTH` (`on|off|auto`, default `auto`; in prod this enables Cloud Run IAM auth for internal service calls)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)
- `RELAYORB_METRICS_EXPORTER` (`prometheus` by default; set `none` to disable `/metrics`)
- `METRICS_AUTH_MODE` (`public` or `bearer`; defaults to `bearer` in prod/demo and `public` elsewhere)
- `METRICS_BEARER_TOKEN` (required when `METRICS_AUTH_MODE=bearer`)
- `REGISTRY_OWNERSHIP_POLICY_PATH` (optional, default `config/registry-ownership.toml`)
- `REGISTRY_WORKER_AUTH_MODE` (`disabled` or `oidc`; optional for registry)
- `REGISTRY_WORKER_OIDC_ISSUER` (registry worker auth, default `https://accounts.google.com`)
- `REGISTRY_WORKER_OIDC_AUDIENCE` (required when registry worker auth mode is `oidc`)
- `REGISTRY_WORKER_JWKS_URL` (registry worker auth, default Google JWKS URL)
- `REGISTRY_WORKER_AUTH_CLOCK_SKEW_SECONDS` (optional for registry worker auth)
- `REGISTRY_WORKER_JWKS_REFRESH_INTERVAL_SECONDS` (optional for registry worker auth)

## Service naming model

Cloud Run services follow `relayorb-<component>-<env>`, for example:
- `relayorb-gateway-prod`
- `relayorb-registry-prod`
- `relayorb-rag-prod`

Workers should set:
- `RELAYORB_ENV`
- `RELAYORB_SERVICE_NAME`
- `REGISTRY_URL`
- `RELAYORB_PUBLIC_BASE_URL` (or `WORKER_BASE_URL` alias)
- `REGISTRY_IDENTITY_AUDIENCE` (required when registry enforces worker OIDC identity)

Production network posture:
- Gateway stays public (OIDC-protected at app layer).
- Registry and workers are private (Cloud Run IAM invoker check + scoped `roles/run.invoker` bindings).
- Internal calls use `X-Serverless-Authorization: Bearer <id_token>` with audience set to the target service run.app URL.

## Observability

- Tracing:
  - JSON structured logs on all services.
  - Optional OTEL export when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
  - Trace propagation headers: `x-trace-id` and `traceparent`.
- Metrics:
  - Prometheus endpoint on each service:
    - gateway: `GET /metrics` on port `8080`
    - registry: `GET /metrics` on port `8081`
    - worker: `GET /metrics` on port `8090`
- In prod/demo, `/metrics` is bearer-protected (`METRICS_AUTH_MODE=bearer`).
  - `relayorb-metrics-scraper-prod` uses an IAM-aware local proxy so each scrape request carries both:
    - `X-Serverless-Authorization` (Cloud Run IAM ID token)
    - `Authorization` (metrics bearer token)
  - Scraped series are exported to Cloud Monitoring as `prometheus.googleapis.com/*`.
  - All service metrics include the base labels:
    - `env`, `service_name`, `version`, `region`
  - Capability/request series also include controlled labels:
    - `capability_id`, `result`, `error_code` (where applicable)
  - Core operational series:
    - `relayorb_gateway_invoke_latency_ms`
    - `relayorb_gateway_invoke_requests_total`
    - `relayorb_gateway_idempotency_replays_total`
    - `relayorb_gateway_jobs_queued`
    - `relayorb_registry_register_requests_total`
    - `relayorb_registry_heartbeat_requests_total`
    - `relayorb_worker_invoke_latency_ms`

## Security

- No secrets are committed.
- Use Secret Manager for credentials.
- Every response includes `requestId` and `traceId`.
- Async job status reads are creator-or-admin (`GET /v1/jobs/:jobId`).
- Registry governance smoke can be run manually:
  - `bash ops/smoke/registry-governance-smoke.sh <registry-url>`

## Project Governance

- License: [LICENSE](/home/khalid/relayorb/LICENSE)
- Security reporting: [SECURITY.md](/home/khalid/relayorb/SECURITY.md)
- Contribution guide: [CONTRIBUTING.md](/home/khalid/relayorb/CONTRIBUTING.md)
- Code of conduct: [CODE_OF_CONDUCT.md](/home/khalid/relayorb/CODE_OF_CONDUCT.md)
- Roadmap: [ROADMAP.md](/home/khalid/relayorb/docs/ROADMAP.md)
