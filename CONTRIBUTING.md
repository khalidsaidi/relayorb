# Contributing

## Development Setup

1. Install Rust toolchain from `rust-toolchain.toml`.
2. Start local dependencies:
   - `cd ops`
   - `docker compose up --build`
3. In another shell, run quality checks:
   - `cargo fmt --all`
   - `cargo clippy --workspace --all-targets --all-features -- -D warnings`
   - `cargo test --workspace`

## Pull Requests

- Keep changes scoped and describe behavior impact.
- Add or update tests/smokes when behavior changes.
- Update docs when API, ops, or deployment flows change.
- Avoid force-pushing over reviewer feedback context unless necessary.

## Security and Secrets

- Never commit secrets, tokens, or key material.
- Use Secret Manager and workflow/environment secrets.
- Do not log auth headers or sensitive payload contents.

## Commit Guidance

- Use clear, imperative commit messages.
- Prefer small commits by concern (code, infra, docs) when practical.
- Run all required checks before requesting review.
