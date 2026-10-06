# Test results

RelayOrb **0.3.3**, tested 2026-10-06 on Linux x64, Linux arm64, macOS arm64, macOS x64 (Rosetta), Windows x64. Full logs: [CI run](https://github.com/khalidsaidi/relayorb/actions/runs/37536987910).

Everything below comes from the compatibility suite in [`tests/compat/`](tests/compat/), run by the
[Compatibility workflow](.github/workflows/compat.yml) on GitHub's Linux, macOS, and Windows machines.
Run it yourself with `python3 tests/compat/harness.py --relayorb target/release/relayorb`.

## Summary

| | Linux x64 | Linux arm64 | macOS arm64 | macOS x64 (Rosetta) | Windows x64 |
|---|---|---|---|---|---|
| Real MCP servers (binary) | 7/7 | 6/6 | 6/6 | 6/6 | 6/6 |
| Stress tests | 10/10 | 10/10 | 10/10 | 10/10 | 9/9 (1 skipped) |
| npm package (npx, 0.3.2) | 2/2 | 2/2 | 2/2 | - | 2/2 |

## Real MCP servers

Each server goes through every step:

- **record**: recorded through `relayorb record` with a real MCP client
- **transparent**: every response recorded equals what the client received
- **show**: `show --json` lists every call
- **export**: `export` writes a session file
- **replay**: `replay` returns the recorded answers for the same calls
- **check**: `check` re-runs the calls against the live server
- **diff**: `diff` compares two runs

| Server | Runtime | Exercises | Linux x64 | Linux arm64 | macOS arm64 | macOS x64 (Rosetta) | Windows x64 |
|---|---|---|---|---|---|---|---|
| `@modelcontextprotocol/server-filesystem` | Node | reads, directory listing, search, unicode filenames, a denied path | pass | pass | pass | pass | pass |
| `@modelcontextprotocol/server-everything` | Node | the MCP reference test server: progress notifications, LLM sampling requests from the server, images, resources, prompts, structured content | pass | pass | pass | pass | pass |
| `@modelcontextprotocol/server-memory` | Node | writes then reads a knowledge graph | pass | pass | pass | pass | pass |
| `mcp-server-time` | Python | deterministic conversion plus a clock that changes every run | pass | pass | pass | pass | pass |
| `mcp-server-git` | Python | status and log on a real repository | pass | pass | pass | pass | pass |
| `mcp-server-fetch` | Python | fetches a live web page | pass | pass | pass | pass | pass |
| `github/github-mcp-server` | Go (Docker) | GitHub's official server, read-only: repository search and file contents | pass | - | - | - | - |

`time` and `github` return live data (the clock, star counts), so `check` and `diff` are expected to report
differences there. They pass when relayorb runs cleanly and pinpoints the changed call.
The GitHub server runs in Docker, so it is tested on Linux only.

## Stress tests

| Test | What happened | Linux x64 | Linux arm64 | macOS arm64 | macOS x64 (Rosetta) | Windows x64 |
|---|---|---|---|---|---|---|
| large_payload | 5 MB response relayed, recorded, and replayed intact (0.10s through the proxy) | pass | pass | pass | pass | pass |
| long_session | 2,000 sequential calls, all recorded (0.25 ms per round trip incl. client) | pass | pass | pass | pass | pass |
| concurrent | 5 recordings started at the same instant on a new database, 200 calls each, nothing lost | pass | pass | pass | pass | pass |
| server_crash | server died mid-call: agent sees end-of-stream, relayorb exits with the server's code (3), session saved with the unanswered call | pass | pass | pass | pass | pass |
| sigterm | SIGTERM to relayorb: server stopped, session saved (relayorb exit 1) | pass | pass | pass | pass | skipped |
| sigkill | relayorb force-killed (how Cursor and Codex stop servers): every call up to the kill is kept, the server exits on its own, and the session shows as killed | pass | pass | pass | pass | pass |
| garbage | non-JSON line on stdout: forwarded untouched, recorded and shown as (not JSON-RPC), session continues | pass | pass | pass | pass | pass |
| batch | JSON-RPC batch: both calls recorded and paired; replay answers a batch with a batch | pass | pass | pass | pass | pass |
| unicode | unicode, emoji, line/paragraph separators, escapes: byte-exact through the proxy and in the recording | pass | pass | pass | pass | pass |
| flood | 2,000 progress notifications during one call: all forwarded in order and recorded | pass | pass | pass | pass | pass |

SIGTERM and SIGKILL do not exist on Windows, so those two tests are skipped there.

## Real agents (manual)

| Agent | Setup | Result | Date |
|---|---|---|---|
| Claude Code 2.1.292 (Linux) | relayorb binary as the MCP command, filesystem server | pass | 2026-10-05 |
| Claude Code 2.1.292 (Linux) | `npx -y @khalidsaidi/relayorb@latest` as the MCP command (no install) | pass | 2026-10-06 |
| Claude Code 2.1.292 (Linux) | two runs, file changed in between, `relayorb diff` pinpoints the changed call | pass | 2026-10-06 |
| Codex CLI 0.160.1 (Linux) | relayorb as an `mcp_servers` command; Codex listed and read files through it | pass | 2026-10-06 |
| Cursor Agent CLI 2026.09.02 (Linux) | relayorb in `.cursor/mcp.json`; Cursor listed and read files through it | pass | 2026-10-06 |
| Cursor Agent CLI 2026.09.02 (Windows) | `npx -y @khalidsaidi/relayorb` in `.cursor/mcp.json` on Windows | pass | 2026-10-06 |
| Claude Desktop 1.44121.2 (Windows) | `npx -y @khalidsaidi/relayorb` in `claude_desktop_config.json`, everything server: `echo` and `get-sum` recorded with their answers | pass | 2026-10-06 |

## Soak test

One recording (relayorb 0.3.2) kept busy for 60 minutes on Linux 6.6.87.2-microsoft-standard-WSL2 x86_64: 167,111 calls (3,343 with 200 KB responses, 84,400 notifications). Recorded: 167,111 of 167,111. Memory: 9.9 MB after warm-up, 9.9 MB at the end. Recordings database: 776.0 MB. Result: pass.

## Compatibility notes (not RelayOrb bugs)

- Claude Desktop 1.44121.2 rejects tools whose `outputSchema` declares JSON Schema draft-07, and the official Node servers (`server-filesystem`, `server-memory`, part of `server-everything`) currently declare draft-07. Those tools fail in Claude Desktop with or without RelayOrb: the recorded `tools/list` is byte-identical to the server's own output. `relayorb show --json` is how this was diagnosed.

## Bugs this suite found (all fixed)

- `list`/`show`: sessions stopped abruptly (Cursor and Codex force-kill their servers) stayed "running" forever. They now show as "killed" (0.3.3).
- `record`: if relayorb was killed (SIGKILL) right after a call, that call could be missing from the recording. Messages are now stored before they are forwarded.
- `check`: tools that ask the agent something mid-call (LLM sampling) failed, because check answered with an error. It now answers the way the agent did in the recording.
- Windows: `relayorb record -- npx ...` could not start the server (`npx` is a `.cmd` file). Commands are now resolved like `cmd.exe` does. This affected 0.3.0 on Windows.
- Windows: when several recordings started at the same instant on a new database, one could exit with "database is locked". Database setup now retries.

## Not tested yet

- VS Code. It uses the same stdio protocol as the agents above, but has not been run yet.
- Remote MCP servers over HTTP. RelayOrb does not support them yet.
- Alpine Linux (musl). The Linux binaries need glibc.
- Sessions much longer than the nightly one-hour soak test, and recordings databases larger than a few hundred MB.
