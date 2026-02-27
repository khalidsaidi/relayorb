# RelayOrb Security

## Threat model

Primary threats:
- unauthorized invocation attempts
- privilege escalation via capability misuse
- replay/spoofing of gateway requests
- secret leakage in code, logs, or CI output
- worker impersonation via forged registration

## Auth modes

- Dev: HMAC signature header (`x-relayorb-signature`) using `SECRET_AUTH_HMAC`.
- Prod: JWT bearer token validated against JWKS URL (`JWT_PUBLIC_KEYS_URL`).

## Policy and least privilege

- Role/capability/side-effect checks are mandatory before routing.
- Budget controls prevent abuse bursts.
- Registry should run internal-only ingress in production.
- Gateway service account should only have required roles:
  - `secretmanager.secretAccessor`
  - `cloudsql.client` (if Cloud SQL is used)

## Secrets handling

- Never commit secrets to git.
- Store runtime credentials in GCP Secret Manager.
- Inject secrets to Cloud Run using `--set-secrets`.
- GoDaddy API credentials are fetched at runtime from Secret Manager.

## Logging and telemetry

- Structured JSON logs with request/trace correlation.
- Avoid payload fields that may include sensitive data.
- Keep auth headers and secret values out of logs.
