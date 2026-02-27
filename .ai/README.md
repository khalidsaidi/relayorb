# .ai workspace

This directory is reserved for agent-internal work artifacts.

Allowed content:
- scratch notes and intermediate planning (`notes/`)
- architecture and ADR-style decisions (`decisions/`)
- temporary debug logs (`logs/`)
- intermediate machine outputs (`artifacts/`)

Never store:
- credentials, API keys, access tokens, private certs, or raw secret dumps
- unredacted production payloads containing sensitive data

Commit policy:
- `decisions/` is intentionally commit-friendly (after secret scrubbing)
- `logs/`, `artifacts/`, and `notes/private/` are ignored by git
