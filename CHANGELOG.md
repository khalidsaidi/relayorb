# Changelog

## v0.3.2

- Docs only: test results (TESTING.md, relayorb.com/testing, and a summary in the README, which is what npm shows). The code is the same as 0.3.1.

## v0.3.1

- `record` stores each message before forwarding it, so everything the agent or server has seen is in the recording even if relayorb is killed. SQLite now uses `synchronous=NORMAL` (WAL), which keeps that fast.
- `check` answers server-initiated requests (sampling, roots, elicitation) the way the agent did in the recording, instead of returning an error. Tools that ask the agent mid-call can now be regression-checked.
- Windows: bare commands like `npx` and `uvx` are found via `PATHEXT` (`npx.cmd`), so MCP configs work unchanged.
- Compatibility suite (`tests/compat/`): 7 real MCP servers, 10 stress tests, run on Linux, macOS, and Windows in CI. See TESTING.md.

## v0.3.0

- `relayorb diff <run-a> <run-b>`: find the first tool call where two runs diverged (different tool, different arguments, or different answer), with each run's agent build, server version, and protocol. `--all`, `--ignore-key`, `--json`; exit 1 when runs differ.
- Session references accept `name~N` for the Nth run before the newest one with that name (`fs~1` = previous run).

## v0.2.1

- Published to npm as `@khalidsaidi/relayorb` (`npx @khalidsaidi/relayorb ...`), with prebuilt binaries for macOS, Linux, and Windows bundled in.

## v0.2.0

### Added

- `relayorb record`: transparent stdio proxy that records every MCP JSON-RPC message to SQLite.
- `relayorb list` / `show [--json]`: session timelines with per-call latency and outcome (including MCP tool errors).
- `relayorb export`: portable JSON session files for committing as test fixtures.
- `relayorb replay`: serve recorded answers as a fake MCP server.
- `relayorb check`: re-send recorded calls to a live server and diff the answers; non-zero exit on change, for CI.
- `relayorb delete`.
- Prebuilt binaries for Linux, macOS, and Windows.
