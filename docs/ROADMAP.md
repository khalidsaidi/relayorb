# RelayOrb Roadmap

## Current Baseline

- Gateway + Registry + Worker SDK implemented.
- OIDC auth, idempotency, async jobs, and governance shipped.
- Cloud Run/Firebase infrastructure and operational smokes in place.
- Anonymous demo path with LB-only ingress and private internals.

## Next Priorities

1. Capability expansion:
   - add production-grade workers (`sql.query@v1`, `doc.patch@v1`, `vector.upsert@v1`)
   - add conformance assets for each capability
2. Reliability and lifecycle:
   - retention cleanup jobs (idempotency and async jobs)
   - stronger capability lifecycle metadata (deprecation/sunset)
3. Security posture:
   - service-account-bound governance everywhere
   - stricter runtime least-privilege review
4. Operability:
   - standardized dashboards and runbook drills
   - alert tuning for false-positive reduction
5. Federation:
   - region-aware routing and registry sharding model

## Versioning Rules

- Capability IDs use `<domain>.<verb>@v<major>`.
- Additive, compatible schema changes stay within major.
- Breaking changes require a new major capability ID.
