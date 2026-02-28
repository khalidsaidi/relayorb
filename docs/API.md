# RelayOrb API

## Gateway

### POST `/v1/invoke`

Request:
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "caller": {
    "agentId": "agent-123",
    "role": "researcher",
    "budgetKey": "team-a"
  },
  "capability": "rag.search@v1",
  "payload": { "query": "market risk", "topK": 3 },
  "trace": { "parentSpanId": "optional" }
}
```

Success response:
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "traceId": "2c3fcf67-2fa1-44f1-9ff9-d7ba88ab8dc2",
  "status": "ok",
  "data": {
    "results": [{ "id": "doc-1", "text": "...", "score": 0.95 }],
    "provider": "relayorb-rag"
  },
  "meta": {
    "routedTo": "http://worker:8090",
    "latencyMs": 42,
    "retries": 0,
    "traceId": "2c3fcf67-2fa1-44f1-9ff9-d7ba88ab8dc2"
  }
}
```

Idempotency behavior (`requestId` is the idempotency key, scoped by `RELAYORB_ENV`):
- First request: normal execution (`200`).
- Duplicate after completion: replayed stored result (`200`, `meta.replayed=true`).
- Duplicate while first request is still running: accepted with in-progress state (`202`).
- Duplicate with different canonical payload hash: rejected (`SCHEMA_VALIDATION_FAILED`).

In-progress (`202`) response shape:
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "traceId": "new-request-trace",
  "status": "ok",
  "data": { "state": "in_progress" },
  "meta": {
    "replayed": true,
    "retryAfterMs": 500,
    "traceId": "original-request-trace"
  }
}
```

### POST `/v1/batchInvoke`

Request: array of `/v1/invoke` payloads.
Each item is processed independently. Batch result entries include:
- `httpStatus`: per-item status code (for example `200` replayed/completed, `202` in-progress)
- `response`: per-item success/error envelope

### POST `/v1/submit`

Asynchronous invoke submission. Uses the same request shape as `/v1/invoke` and additionally accepts:
- `callbackUrl` (optional)
- `maxRunMs` (optional)
- `maxAttempts` (optional, 1-10)

Response (`202` for new queued job, `200` for idempotent replay):
```json
{
  "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
  "traceId": "2c3fcf67-2fa1-44f1-9ff9-d7ba88ab8dc2",
  "status": "ok",
  "data": {
    "jobId": "b10d5a2c-7f98-4117-9ac8-18f5f3ce29d4",
    "requestId": "8f5b5b6a-8d10-4a45-89b6-89fb67235d50",
    "state": "queued",
    "statusUrl": "/v1/jobs/b10d5a2c-7f98-4117-9ac8-18f5f3ce29d4",
    "attempts": 0,
    "maxAttempts": 3
  }
}
```

Submit idempotency behavior (`requestId` scoped by `RELAYORB_ENV`):
- Same `requestId` + same canonical payload: returns existing `jobId`.
- Same `requestId` + different payload hash: `SCHEMA_VALIDATION_FAILED`.

### GET `/v1/jobs/:jobId`

Returns asynchronous job state and results.
Possible states:
- `queued`
- `running`
- `succeeded`
- `failed`

Uses gateway auth (`Authorization: Bearer ...` in OIDC mode, HMAC in HMAC mode).
Read authorization is `creator-or-admin`:
- Creator when OIDC `sub` matches the submitting caller subject.
- Fallback creator match by `agentId` (HMAC mode: send `x-relayorb-agent-id`).
- Admin roles: `admin`, `ops`, `platform-admin` (HMAC mode: `x-relayorb-role` or `x-relayorb-roles`).

If job exists but caller is not allowed to read it, gateway returns `FORBIDDEN`.

### GET `/v1/replay/:requestId`

Returns canonical request artifact and stored invocation state (`in_progress|completed|failed`) for replay/audit.

## Registry

### GET `/health`
Service health/readiness envelope with `requestId` and `traceId`.

### POST `/v1/register`
Worker self-registers instance + manifests with TTL.
Registration includes `env` and `serviceName`.
In `prod`, capability ownership rules may restrict registration by `serviceName` for specific capability prefixes.
When ownership rules define `allowed_service_accounts`, registration must include `Authorization: Bearer <worker id token>` and the token identity must match the rule allowlist.

### POST `/v1/heartbeat`
Worker refreshes TTL and uploads load stats.

### GET `/v1/capabilities/:capabilityId`
Returns manifest and provider list.
Query params:
- `includeUnhealthy=1` (optional)
- `env=<dev|staging|prod>` (optional, defaults to registry env)

Registry env behavior:
- Non-prod registries may use `env` override for diagnostics.
- Prod registries do not allow cross-env override. When `RELAYORB_ENV=prod`, `env` must be absent or `prod`.

### GET `/v1/discover?prefix=rag.`
Returns matching capability IDs.

## Error shape

All services return:
```json
{
  "requestId": "...",
  "traceId": "...",
  "status": "error",
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "human readable",
    "details": {}
  }
}
```
