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

1. Gateway authenticates request (HMAC in dev, JWT in prod).
2. Gateway loads capability manifest + healthy providers from Registry.
3. Gateway enforces policy (`role`, `capability`, `sideEffects`) and budget limits.
4. Gateway validates input payload against manifest `inputSchema`.
5. Gateway selects provider using latency EWMA then in-flight count.
6. Gateway forwards invoke request to Worker.
7. Gateway validates worker response against `outputSchema`.
8. Gateway records canonicalized request + response artifact.
9. Gateway returns response with `requestId` and `traceId`.

## Failure modes

- Registry unavailable: gateway returns `INTERNAL` / dependency failure.
- Capability missing: `CAPABILITY_NOT_FOUND`.
- No healthy workers: `NO_HEALTHY_PROVIDERS`.
- Policy deny: `FORBIDDEN`.
- Budget exhausted: `BUDGET_EXCEEDED`.
- Schema mismatch: `SCHEMA_VALIDATION_FAILED`.
- Worker timeout/error: `WORKER_TIMEOUT` or `WORKER_ERROR`.
