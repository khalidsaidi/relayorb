# RelayOrb

RelayOrb is a capability gateway for AI agents. It enforces auth and policy, routes to healthy workers via a registry, validates schemas end-to-end, and records deterministic invocation artifacts with request-id idempotency and replay.

Gateway also supports asynchronous execution via `POST /v1/submit` and `GET /v1/jobs/:jobId`.

## Components

- `relayorb-gateway`: invoke entrypoint, policy, routing, artifact recording
- `relayorb-registry`: capability registry + TTL heartbeats
- `relayorb-worker-sdk`: worker server wrapper and heartbeat client
- `relayorb-policy`: RBAC/ABAC-lite rules and budget limiter
- `worker-mock-rag`: sample capability provider (`rag.search@v1`)
- `agent-client`: sample CLI invoker

## Quickstart

1. Start stack:
```bash
cd ops
docker compose up --build
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

## Add a capability worker

1. Define manifest with `capabilityId`, schemas, limits, and routing hints.
2. Implement `CapabilityHandler` in an SDK-based worker.
3. Register worker capabilities on startup and send heartbeats.
4. Add policy rule allowing target role/capability/sideEffects.

## Capability Conformance Harness

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
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)
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

## Security

- No secrets are committed.
- Use Secret Manager for credentials.
- Every response includes `requestId` and `traceId`.
- Async job status reads are creator-or-admin (`GET /v1/jobs/:jobId`).
- Registry governance smoke can be run manually:
  - `bash ops/smoke/registry-governance-smoke.sh <registry-url>`
