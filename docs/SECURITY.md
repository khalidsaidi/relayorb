# RelayOrb Security

## Threat model

Primary threats:
- unauthorized invocation attempts
- privilege escalation via capability misuse
- replay/spoofing of gateway requests
- secret leakage in code, logs, or CI output
- worker impersonation via forged registration

## Auth modes

- `AUTH_MODE=hmac`: HMAC signature header (`x-relayorb-signature`) using `SECRET_AUTH_HMAC`.
- `AUTH_MODE=oidc` (recommended prod): JWT bearer token with:
  - strict signature verification using `JWKS_URL`
  - issuer check (`OIDC_ISSUER`)
  - audience check (`OIDC_AUDIENCE`)
  - time validation with bounded skew (`AUTH_CLOCK_SKEW_SECONDS`)
  - key-rotation support via periodic JWKS refresh + refresh-on-kid-miss

Default behavior:
- `RELAYORB_ENV=prod` with `AUTH_MODE=auto` or empty resolves to OIDC.
- non-prod defaults to HMAC for local velocity.
- `RELAYORB_ENV=prod` with `AUTH_MODE=hmac` requires `ALLOW_HMAC_IN_PROD=true`.

## Policy and least privilege

- Role/capability/side-effect checks are mandatory before routing.
- Budget controls prevent abuse bursts.
- Registry isolates provider lookups by environment (`env`), preventing cross-env routing.
- Registry supports capability ownership governance in prod (`config/registry-ownership.toml`):
  - capability prefix rules map to allowed worker `serviceName` values.
  - optional `allowed_service_accounts` binds governed capability registration to verified OIDC worker identity (service account email/subject), not only claimed `serviceName`.
  - registration is rejected with `FORBIDDEN` when a non-owner service attempts governed capability registration.
  - prod registry blocks cross-env `env` override on capability lookup.
- Async job reads (`GET /v1/jobs/:id`) are creator-or-admin only:
  - creator match by OIDC `sub` (preferred),
  - fallback creator match by `agentId`,
  - admin allowlist roles: `admin`, `ops`, `platform-admin`.
- Gateway service account should only have required roles:
  - `secretmanager.secretAccessor`
  - `cloudsql.client` (if Cloud SQL is used)

## Network posture hardening (Option B)

- `relayorb-gateway-prod` stays public at Cloud Run ingress and is protected by app-level OIDC auth.
- `relayorb-registry-prod` and `relayorb-rag-prod` are private at Cloud Run IAM (`roles/run.invoker` scoped to runtime SAs only).
- Internal service-to-service calls use Cloud Run ID tokens from metadata server:
  - `gateway -> registry`
  - `gateway -> worker`
  - `worker -> registry`
  - `metrics-scraper -> gateway/registry/worker`
- Internal IAM auth uses `X-Serverless-Authorization: Bearer <id_token>` so app-level `Authorization` can remain dedicated to API auth or metrics bearer checks.
- Registry governance remains identity-bound in prod using verified worker OIDC claims (`sub`/`email`) and allowed service account bindings.

## Secrets handling

- Never commit secrets to git.
- Store runtime credentials in GCP Secret Manager.
- Inject secrets to Cloud Run using `--set-secrets`.
- GoDaddy API credentials are fetched at runtime from Secret Manager.
- Use env-scoped secrets (for example `relayorb-prod-gateway-db`, `relayorb-prod-registry-db`).
- Use dedicated env-scoped metrics tokens (for example `relayorb-prod-gateway-metrics-token`, `relayorb-prod-registry-metrics-token`).

## Logging and telemetry

- Structured JSON logs with request/trace correlation.
- Avoid payload fields that may include sensitive data.
- Keep auth headers and secret values out of logs.
- Protect `/metrics` in prod/demo with `METRICS_AUTH_MODE=bearer`.
  - For public services (gateway), unauthenticated `/metrics` returns `401`.
  - For private services (registry/worker), unauthenticated calls are blocked at Cloud Run IAM with `403` before app-level auth runs.
