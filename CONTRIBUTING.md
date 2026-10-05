# Contributing

## Development Setup

1. Install the Rust toolchain from `rust-toolchain.toml`.
2. Install `python3`, which the integration tests use to run a mock MCP server.
3. Run the quality checks:
   - `cargo fmt --all`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo test --workspace`

The website lives in `site/` (`pnpm install && pnpm dev`).

## Pull Requests

- Keep changes scoped and describe the behavior impact.
- Add or update tests when behavior changes. End-to-end tests live in `crates/relayorb/tests/`.
- Update `README.md` when commands or flags change.

## Security and Secrets

- Never commit secrets, tokens, or key material.
- Recorded sessions can contain sensitive tool data. Don't commit real recordings as fixtures without scrubbing them.

## Commit Guidance

- Use clear, imperative commit messages.
- Run all checks before requesting review.
