# ADR-0001: RelayOrb foundational architecture

- Status: accepted
- Date: 2026-02-27

## Decision
Use a Rust workspace with dedicated crates for core models, policy, registry service, gateway service, worker SDK, and sample implementations.

## Rationale
- strict typing and reliable async runtime
- shared error shape and schema enforcement in a single core crate
- deployable service boundaries aligned to Cloud Run

## Security notes
No secrets are stored in this repository. Runtime credentials are expected from environment variables or GCP Secret Manager references.
