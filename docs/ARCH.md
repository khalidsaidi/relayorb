# RelayOrb Architecture

## Overview

RelayOrb provides capability routing for AI agents via a policy-aware gateway and a heartbeat-driven worker registry.

```
Agent Client
    |
    | POST /v1/invoke
    v
+-------------------+
| RelayOrb Gateway  |
| auth + policy     |
| schema + routing  |
| async job runner  |
+---------+---------+
          |
          | GET /v1/capabilities/:id
          v
+-------------------+
| RelayOrb Registry |
| manifests + TTL   |
+---------+---------+
          |
          | route to healthy provider
          v
+---------------------------+
| Worker (SDK-based server) |
| /invoke/:capability       |
+---------------------------+
```

## Invocation flow

1. Gateway authenticates request (`AUTH_MODE=hmac|oidc`; prod defaults to OIDC JWT via JWKS).
2. Gateway canonicalizes request payload and claims idempotency slot by (`env`, `requestId`).
3. Duplicate handling:
   - completed -> replay stored response
   - failed -> replay stored error
   - in_progress -> return `202` with retry hint
4. Gateway loads capability manifest + healthy providers from Registry scoped to the same `RELAYORB_ENV`.
5. Gateway enforces policy (`role`, `capability`, `sideEffects`) and budget limits.
6. Gateway validates input payload against manifest `inputSchema`.
7. Gateway selects provider using latency EWMA then in-flight count.
8. Gateway forwards invoke request to Worker with transient-only retries (exponential backoff).
9. Gateway propagates `x-trace-id` and W3C `traceparent` to downstream Registry/Worker calls.
10. Gateway validates worker response against `outputSchema`.
11. Gateway records final invocation state (`completed|failed`) plus canonical request and response/error artifact.
12. Gateway returns response with `requestId` and `traceId`.

## Async flow

1. Client submits job using `POST /v1/submit`.
2. Gateway validates auth/schema and writes a queued job row keyed by (`env`, `requestId`).
3. Background runner leases queued jobs (`state=queued`, `available_at<=now`).
4. Runner executes the same invoke pipeline as synchronous requests.
5. On transient failure (`WORKER_TIMEOUT`, `WORKER_ERROR`, `NO_HEALTHY_PROVIDERS`, `INTERNAL`) and remaining attempts, job is re-queued with exponential backoff.
6. Job transitions to `succeeded` or `failed` with stored `result_json`/`error_json`.
7. Client polls `GET /v1/jobs/:jobId`.

## Observability

- Traces:
  - JSON logs everywhere with `requestId` + `traceId`.
  - Optional OTLP export (`OTEL_EXPORTER_OTLP_ENDPOINT`) in gateway, registry, and workers.
  - `traceparent` propagation for cross-service trace continuity.
- Metrics:
  - `GET /metrics` exposed by gateway, registry, and worker services.
  - Gateway tracks invoke latency/error, idempotency replay rate, worker retries, and queued job depth.
  - Registry tracks registration/heartbeat volume, lookup volume, governance denials, and healthy provider counts.
  - Worker tracks invoke latency/error, in-flight requests, and registry registration/heartbeat outcomes.

## Failure modes

- Registry unavailable: gateway returns `INTERNAL` / dependency failure.
- Capability missing: `CAPABILITY_NOT_FOUND`.
- No healthy workers: `NO_HEALTHY_PROVIDERS`.
- Cross-env worker isolation: registry filters providers by `env` to prevent dev/staging/prod bleed.
- Policy deny: `FORBIDDEN`.
- Budget exhausted: `BUDGET_EXCEEDED`.
- Schema mismatch: `SCHEMA_VALIDATION_FAILED`.
- Worker timeout/error: `WORKER_TIMEOUT` or `WORKER_ERROR`.
- RequestId hash mismatch (same id, different payload): `SCHEMA_VALIDATION_FAILED`.
- Duplicate while active: `202` in-progress dedupe response.
- Job runner lease conflicts: optimistic lease ensures only one runner claims a queued row.
- Async retries exhausted: final state becomes `failed` with stored error envelope.
