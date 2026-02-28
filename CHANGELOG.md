# Changelog

## v0.1.0 - 2026-02-28

### Added

- Anonymous public demo stack on GCP with load balancer entrypoint, Cloud Armor rate controls, and hardened smoke verification.
- Demo deploy verification gate (`ops/smoke/demo-deploy-verify.sh`) wired into `.github/workflows/deploy-demo.yml`.
- Capability conformance harness and CI/live conformance workflows.
- Open source governance docs and templates (`SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue templates, roadmap).

### Security

- Registry and worker services are private behind Cloud Run IAM (no public invoker).
- Internal service-to-service calls use Cloud Run ID tokens (`X-Serverless-Authorization`).
- Demo enforces read-only capability allowlist, request size bounds, strict timeouts, and rate limiting.
- Metrics remain bearer-protected in prod/demo.

### Developer Experience

- Documentation funnel clarified:
  - Try (anonymous demo)
  - Run locally (docker compose)
  - Deploy (Terraform)
  - Extend (worker SDK)
  - Verify (conformance harness)

### Notes

- Public demo is best-effort and rate-limited for abuse/cost control.
- Demo is a showcase environment, not a hosted multi-tenant SLA product.
