# Security Policy

RelayOrb runs locally and makes no network calls of its own. It forwards bytes between an MCP client and the server it launches, and stores what it sees in a local SQLite file (`~/.relayorb/recordings.db` by default).

Things to keep in mind:

- Recordings contain everything the tools received and returned, including file contents and secrets passed as arguments. Protect the database file and review exported session files before sharing or committing them.
- `relayorb record` and `relayorb check` run the server command you give them, with your permissions.

## Reporting a Vulnerability

- Do not open public issues for suspected vulnerabilities.
- Use GitHub Security Advisories (private report) for this repository.
- Include reproduction steps and an impact assessment.
