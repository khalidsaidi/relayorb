# RelayOrb

**A flight recorder for AI agents.** RelayOrb sits between an AI agent and its MCP tool servers, records every message that passes through, and lets you inspect, replay, and regression-check those sessions.

- **Debug** a strange agent run: see exactly which tools were called, with what arguments, what came back, and how long it took.
- **Reproduce** a bug: replay the recorded session, and the agent gets the same tool answers again.
- **Test without real tools:** replay a recording instead of hitting live (or paid) APIs. No keys, no network, same answers every time.
- **Catch regressions in CI:** re-send recorded calls to your MCP server and fail the build if an answer changed.

It's a single local binary. No account, no cloud, no telemetry. Recordings stay on your machine in a SQLite file.

Website: https://relayorb.com

## Install

```bash
cargo install --git https://github.com/khalidsaidi/relayorb relayorb
```

Prebuilt binaries for Linux, macOS, and Windows are attached to each [GitHub release](https://github.com/khalidsaidi/relayorb/releases).

## Record

Put `relayorb record --` in front of any stdio MCP server command. For example, in Claude Desktop's `claude_desktop_config.json` (Cursor and other MCP clients use the same shape):

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "relayorb",
      "args": ["record", "--name", "fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/me/notes"]
    }
  }
}
```

With Claude Code:

```bash
claude mcp add fs -- relayorb record --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/notes
```

The agent works exactly as before, because bytes are forwarded unchanged in both directions. Each time the agent starts the server, a new session is recorded.

## Inspect

```console
$ relayorb list
ID        NAME              STARTED (UTC)         MESSAGES  DURATION  COMMAND
a25198e1  fs                2026-10-05 08:07:09          9      6.0s  npx -y @modelcontextprotocol/server-filesystem /Users/me/notes

$ relayorb show a25198e1
session a25198e1 (fs)  started 2026-10-05 08:07:09 UTC  (6.0s, exit 0)
command: npx -y @modelcontextprotocol/server-filesystem /Users/me/notes

    0.035s  ->  initialize                                   49ms  ok
    0.035s  ->  notifications/initialized
    0.102s  ->  tools/list                                    4ms  ok
    1.310s  ->  tools/call list_directory                     6ms  ok
    2.004s  ->  tools/call read_text_file                     3ms  tool error: Access denied - path outside allowed directories
```

`relayorb show <id> --json` prints every call with its full params and response, ready for `jq`.

Anywhere a session is expected, you can use its `--name` (the newest session with that name), its id, or any unique id prefix.

## Replay

`relayorb replay` pretends to be the MCP server and answers from a recording:

```bash
relayorb replay a25198e1
```

Use it anywhere a server command goes, for example in an agent test harness, so the agent runs against recorded tool answers instead of live tools.

Matching rules for each incoming request:
1. Same method and same params (key order and `_meta` are ignored): the recorded answers come back in order.
2. Otherwise, same method and the same tool, prompt, or resource name: the recorded answers come back in order.
3. Once those run out, the last answer is repeated. Anything never recorded gets a JSON-RPC error, so the agent never hangs.

## Check (regression tests for MCP servers)

Save a session as a fixture and commit it:

```bash
relayorb export a25198e1 -o tests/fixtures/fs-session.json
```

Then, in CI, re-send the recorded calls to the current build of the server:

```console
$ relayorb check tests/fixtures/fs-session.json -- node dist/server.js
relayorb check: 3 recorded calls against `node dist/server.js`
  PASS  tools/list                                   11ms
  FAIL  tools/call list_directory                     4ms
        ~ result.content[0].text: "[FILE] a.md\n[FILE] b.md" -> "[FILE] a.md"
  PASS  tools/call read_text_file                     0ms
2 passed, 1 failed
```

The exit code is `0` when everything matches, `1` when an answer changed, and `2` when the server couldn't be started or initialized. Use `--ignore-key <name>` (repeatable) to skip fields that change on every run, such as timestamps or request ids.

## Reference

| Command | What it does |
|---|---|
| `relayorb record [--name N] -- <server...>` | Run a stdio MCP server and record all traffic |
| `relayorb list` | List sessions, newest first |
| `relayorb show <session> [--json]` | Timeline of calls, latencies, and outcomes |
| `relayorb export <session> [-o file]` | Save a session as a portable JSON file |
| `relayorb replay <session-or-file>` | Serve recorded answers as a fake MCP server |
| `relayorb check <session-or-file> -- <server...>` | Diff a live server against a recording |
| `relayorb delete <session>` | Delete a session |

Recordings are stored in `~/.relayorb/recordings.db`. Override this with `--db <path>` or `RELAYORB_DB`.

### Good to know

- **Recordings contain everything the tools saw and returned**, including file contents, API responses, and any secrets passed as arguments. Treat exported session files accordingly before committing them.
- RelayOrb supports the stdio transport, which is what local MCP servers use. Streamable HTTP servers aren't supported yet.
- `check` answers server-initiated requests (sampling, roots) with a "not supported" error, so servers that depend on them won't check cleanly.

## Development

```bash
cargo fmt --all
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace   # integration tests need python3 for the mock MCP server
```

The website lives in [`site/`](site/) (Next.js, deployed to Vercel on pushes to `main`).

## License

Apache-2.0
