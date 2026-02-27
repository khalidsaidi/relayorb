# RelayOrb

RelayOrb is a capability gateway for AI agents. It enforces auth and policy, routes to healthy workers via a registry, validates schemas end-to-end, and records deterministic invocation artifacts.

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

## Configuration

Base config is `config/dev.toml`, overridden by env vars:
- `RELAYORB_ENV`
- `RELAYORB_REGION`
- `REGISTRY_URL`
- `DATABASE_URL`
- `SECRET_AUTH_HMAC` (dev)
- `JWT_PUBLIC_KEYS_URL` (prod)
- `OTEL_EXPORTER_OTLP_ENDPOINT` (optional)

## Security

- No secrets are committed.
- Use Secret Manager for credentials.
- Every response includes `requestId` and `traceId`.
