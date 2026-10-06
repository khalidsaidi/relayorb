# Test results

RelayOrb **0.3.1**, tested 2026-10-06 on Linux x64, macOS arm64, Windows x64. Full logs: [CI run](https://github.com/khalidsaidi/relayorb/actions/runs/37524395200).

Everything below comes from the compatibility suite in [`tests/compat/`](tests/compat/), run by the
[Compatibility workflow](.github/workflows/compat.yml) on GitHub's Linux, macOS, and Windows machines.
Run it yourself with `python3 tests/compat/harness.py --relayorb target/release/relayorb`.

## Summary

| | Linux x64 | macOS arm64 | Windows x64 |
|---|---|---|---|
| Real MCP servers (binary) | 7/7 | 6/6 | 6/6 |
| Stress tests | 10/10 | 10/10 | 8/8 (2 skipped) |
| npm package (npx) | 2/2 | 2/2 | 2/2 |

## Real MCP servers

Each server goes through every step:

- **record**: recorded through `relayorb record` with a real MCP client
- **transparent**: every response recorded equals what the client received
- **show**: `show --json` lists every call
- **export**: `export` writes a session file
- **replay**: `replay` returns the recorded answers for the same calls
- **check**: `check` re-runs the calls against the live server
- **diff**: `diff` compares two runs

| Server | Runtime | Exercises | Linux x64 | macOS arm64 | Windows x64 |
|---|---|---|---|---|---|
| `@modelcontextprotocol/server-filesystem` | Node | reads, directory listing, search, unicode filenames, a denied path | pass | pass | pass |
| `@modelcontextprotocol/server-everything` | Node | the MCP reference test server: progress notifications, LLM sampling requests from the server, images, resources, prompts, structured content | pass | pass | pass |
| `@modelcontextprotocol/server-memory` | Node | writes then reads a knowledge graph | pass | pass | pass |
| `mcp-server-time` | Python | deterministic conversion plus a clock that changes every run | pass | pass | pass |
| `mcp-server-git` | Python | status and log on a real repository | pass | pass | pass |
| `mcp-server-fetch` | Python | fetches a live web page | pass | pass | pass |
| `github/github-mcp-server` | Go (Docker) | GitHub's official server, read-only: repository search and file contents | pass | - | - |

`time` and `github` return live data (the clock, star counts), so `check` and `diff` are expected to report
differences there. They pass when relayorb runs cleanly and pinpoints the changed call.
The GitHub server runs in Docker, so it is tested on Linux only.

## Stress tests

| Test | What happened | Linux x64 | macOS arm64 | Windows x64 |
|---|---|---|---|---|
| large_payload | 5 MB response relayed, recorded, and replayed intact (0.11s through the proxy) | pass | pass | pass |
| long_session | 2,000 sequential calls, all recorded (0.41 ms per round trip incl. client) | pass | pass | pass |
| concurrent | 5 recordings started at the same instant on a new database, 200 calls each, nothing lost | pass | pass | pass |
| server_crash | server died mid-call: agent sees end-of-stream, relayorb exits with the server's code (3), session saved with the unanswered call | pass | pass | pass |
| sigterm | SIGTERM to relayorb: server stopped, session saved (relayorb exit 1) | pass | pass | skipped |
| sigkill | relayorb killed with SIGKILL: server exits on its own (stdin closes), calls recorded so far are kept; session stays marked running | pass | pass | skipped |
| garbage | non-JSON line on stdout: forwarded untouched, recorded and shown as (not JSON-RPC), session continues | pass | pass | pass |
| batch | JSON-RPC batch: both calls recorded and paired; replay answers a batch with a batch | pass | pass | pass |
| unicode | unicode, emoji, line/paragraph separators, escapes: byte-exact through the proxy and in the recording | pass | pass | pass |
| flood | 2,000 progress notifications during one call: all forwarded in order and recorded | pass | pass | pass |

SIGTERM and SIGKILL do not exist on Windows, so those two tests are skipped there.

## Real agents (manual)

| Agent | Setup | Result | Date |
|---|---|---|---|
| Claude Code 2.1.292 | relayorb binary as the MCP command, filesystem server | pass | 2026-10-05 |
| Claude Code 2.1.292 | `npx -y @khalidsaidi/relayorb@latest` as the MCP command (no install) | pass | 2026-10-06 |
| Claude Code 2.1.292 | two runs, file changed in between, `relayorb diff` pinpoints the changed call | pass | 2026-10-06 |

## Bugs this suite found (fixed in 0.3.1)

- `record`: if relayorb was killed (SIGKILL) right after a call, that call could be missing from the recording. Messages are now stored before they are forwarded.
- `check`: tools that ask the agent something mid-call (LLM sampling) failed, because check answered with an error. It now answers the way the agent did in the recording.
- Windows: `relayorb record -- npx ...` could not start the server (`npx` is a `.cmd` file). Commands are now resolved like `cmd.exe` does. This affected 0.3.0 on Windows.
- Windows: when several recordings started at the same instant on a new database, one could exit with "database is locked". Database setup now retries.

## Not tested yet

- Agents other than Claude Code: Cursor, Codex, Claude Desktop, VS Code. They use the same stdio protocol, but nobody has run them yet.
- Remote MCP servers over HTTP. RelayOrb does not support them yet.
- The Intel macOS and Linux ARM binaries. They are built and published but were not run in this suite.
- Alpine Linux (musl). The Linux binaries need glibc.
- Very long-running sessions (hours) and recordings databases larger than a few hundred MB.
