# RelayOrb Public Demo

RelayOrb provides an anonymous public demo endpoint so anyone can try invoke flows with plain `curl`.

## Try it now

Current live endpoint (as of 2026-03-01):

```bash
export RELAYORB_DEMO_URL="http://34.8.48.11"
```

If the demo URL changes, fetch the latest from Terraform output:

```bash
terraform -chdir=infra/gcp/terraform/envs/demo output -raw demo_http_url
terraform -chdir=infra/gcp/terraform/envs/demo output -raw demo_https_url 2>/dev/null || true
```

Anonymous invoke (no token, no API key):

```bash
curl -sS -X POST "$RELAYORB_DEMO_URL/v1/invoke" \
  -H "content-type: application/json" \
  -d '{
    "requestId": "demo-req-1",
    "caller": {"agentId": "anonymous", "role": "anonymous"},
    "capability": "rag.search@v1",
    "payload": {"query": "what is RelayOrb?", "topK": 3}
  }' | jq
```

Anonymous echo:

```bash
curl -sS -X POST "$RELAYORB_DEMO_URL/v1/invoke" \
  -H "content-type: application/json" \
  -d '{
    "requestId": "demo-req-2",
    "caller": {"agentId": "anonymous", "role": "anonymous"},
    "capability": "demo.echo@v1",
    "payload": {"text": "hello demo"}
  }' | jq
```

## Demo guardrails

The anonymous demo is intentionally constrained:

- No auth required for users (`AUTH_MODE=none`) but only in `RELAYORB_ENV=demo`.
- Demo only exposes `POST /v1/invoke` (+ health/metrics for ops).
  - `POST /v1/submit` is disabled.
  - `GET /v1/jobs/:id` is disabled.
- Capability allowlist enforced by gateway (default: `rag.search@v1`, `demo.echo@v1`).
- Read-only capabilities only (`sideEffects=read_only`).
- Strict request limits:
  - body size capped (default 32KiB),
  - tighter timeout caps,
  - strict payload bounds for demo parameters (e.g., query/topK).
- Multi-layer abuse controls:
  - Cloud Armor per-IP throttling,
  - gateway app-level per-IP token bucket,
  - low Cloud Run max-instance limits.
- Cost guardrails:
  - configure a Cloud Billing budget + alerting in the demo project,
  - keep a fast panic button (Cloud Armor deny rule) for abuse spikes.
- Demo worker posture:
  - keep capabilities read-only and avoid paid upstream dependencies by default.
- Short TTL cache for identical read-only requests to reduce compute.

## Privacy and retention

- Requests are logged for reliability and abuse prevention.
- Do not send secrets or sensitive personal data to the public demo.
- Metrics are not public; `/metrics` remains bearer-protected.

## Security posture

- Public entrypoint: `relayorb-gateway-demo` behind External Load Balancer + Cloud Armor.
- Use only the LB URL for demo traffic; direct gateway `*.run.app` access is intentionally blocked.
- Private internal services: `relayorb-registry-demo`, `relayorb-rag-demo`, `relayorb-metrics-scraper-demo`.
- Direct public calls to registry/worker run.app URLs are blocked by Cloud Run IAM.
- Registry/worker invocations are restricted to runtime service accounts (gateway/scraper/worker as configured by IAM bindings).
- Service-to-service requests use Cloud Run ID tokens (`X-Serverless-Authorization`).

## Deploy

- Terraform Registry demo module:
  - `khalidsaidi/relayorb-demo/google`
  - https://registry.terraform.io/modules/khalidsaidi/relayorb-demo/google/latest
- Terraform stack: `infra/gcp/terraform/envs/demo/`
- GitHub Actions workflow: `.github/workflows/deploy-demo.yml`
- Required GitHub secret for remote state: `GCP_DEMO_TF_STATE_BUCKET` (bucket name only, no `gs://`)
- The deploy SA used by `deploy-demo.yml` must have `roles/storage.objectAdmin` on that bucket.
- Smoke script: `ops/smoke/demo-anon-smoke.sh`
- Full deploy+posture verifier: `ops/smoke/demo-deploy-verify.sh`

Registry-module usage:

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

If you need to customize internals, use the in-repo Terraform under `infra/gcp/terraform/envs/demo/` and pin to a Git tag/commit.

## Panic button

To block demo traffic immediately without redeploying:

```bash
gcloud compute security-policies rules update 2147483647 \
  --project <DEMO_PROJECT_ID> \
  --security-policy relayorb-demo-armor \
  --action "deny-403"
```

Restore default allow action when ready:

```bash
gcloud compute security-policies rules update 2147483647 \
  --project <DEMO_PROJECT_ID> \
  --security-policy relayorb-demo-armor \
  --action "allow"
```
