# RelayOrb

**Turn real AI agent sessions into tests for MCP servers.**

RelayOrb records the messages between an AI agent (Claude Code, Cursor, Codex, Claude Desktop) and an MCP server. Save a recording, and RelayOrb can:

- **Check** every new build of your MCP server against it in CI, and fail if any answer changed (`relayorb check`).
- **Replay** it in place of the real server, so agent tests run offline with the same answers every time (`relayorb replay`).
- **Show** the raw JSON-RPC traffic when a tool call goes wrong: every request, response, error, and latency (`relayorb show`).

**Who it's for:** people who build MCP servers (the main use), people who build agents or apps on top of MCP tools, and anyone who needs the exact protocol messages to debug a tool call.

**When you don't need it:** if you only want to see what your agent did once, Claude Code, Cursor, and other agent apps already show tool calls. RelayOrb also only works with local (stdio) MCP servers, not remote HTTP ones.

It's a single local binary. No account, no cloud, no telemetry, and free (Apache-2.0).

Website: https://relayorb.com

## Tested

RelayOrb 0.3.1 is tested on every change against 7 real MCP servers (filesystem, everything, memory, time, git, fetch, and GitHub's official server), plus 10 stress tests: 5 MB payloads, 2,000-call sessions, parallel recordings, crashes and kills, batches, unicode, and notification floods. They run on Linux, macOS, and Windows, with both the binary and the npm package:

| | Linux x64 | macOS arm64 | Windows x64 |
|---|---|---|---|
| Real MCP servers (binary) | 7/7 | 6/6 | 6/6 |
| Stress tests | 10/10 | 10/10 | 8/8 (2 skipped) |
| npm package (npx) | 2/2 | 2/2 | 2/2 |

It has also been tested with Claude Code as the agent. Cursor, Codex, and Claude Desktop haven't been tested yet. Full results, including the bugs the suite found and what's still untested: [TESTING.md](https://github.com/khalidsaidi/relayorb/blob/main/TESTING.md) · [relayorb.com/testing](https://relayorb.com/testing)

## Install

```bash
curl -fsSL https://relayorb.com/install.sh | sh
```

Or with npm (bundles the prebuilt binary for macOS, Linux, and Windows):

```bash
npm install -g @khalidsaidi/relayorb    # or run it without installing: npx @khalidsaidi/relayorb --help
```

Prebuilt binaries are also attached to each [GitHub release](https://github.com/khalidsaidi/relayorb/releases), or build from source with `cargo install --git https://github.com/khalidsaidi/relayorb relayorb`.

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

Without installing anything, use `npx` as the command:

```json
"command": "npx",
"args": ["-y", "@khalidsaidi/relayorb", "record", "--name", "fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/me/notes"]
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

## Diff (why did this run behave differently?)

Agents don't do the same thing twice. When one run fails and another passes, `relayorb diff` finds the first tool call where they went different ways: a different tool, different arguments, or the same call getting a different answer.

```console
$ relayorb diff notes~1 notes
relayorb diff: A = 1e9ae080 (notes)   B = e41ecc9a (notes)
  client    A: claude-code 2.1.292              B: claude-code 2.1.292
  server    A: secure-filesystem-server 0.2.0   B: secure-filesystem-server 0.2.0
  protocol  A: 2025-11-25                       B: 2025-11-25
  calls     A: 4                                B: 4

First divergence at call #3 (2 matching calls before it): same call, different answer
  A: tools/call list_directory   {"name":"list_directory",...}  [ok]
  B: tools/call list_directory   {"name":"list_directory",...}  [ok]
     ~ result.content[0].text: "[FILE] cal.txt\n[FILE] todo.txt" -> "[FILE] cal.txt\n[FILE] health.txt\n[FILE] todo.txt"
```

- `name~1` is the run before the newest one with that name, so `relayorb diff fs~1 fs` compares your last two runs. Exported JSON files work too.
- The header shows each run's agent build, server version, and protocol, which come from the recorded `initialize`. A host update is often the answer to "what changed?".
- `--all` lists every difference, `--ignore-key` skips noisy fields, and `--json` gives machine-readable output. That makes it easy to group many failed runs by their first divergence.
- Exit code: `0` when the runs match, `1` when they diverge.

## Reference

| Command | What it does |
|---|---|
| `relayorb record [--name N] -- <server...>` | Run a stdio MCP server and record all traffic |
| `relayorb list` | List sessions, newest first |
| `relayorb show <session> [--json]` | Timeline of calls, latencies, and outcomes |
| `relayorb export <session> [-o file]` | Save a session as a portable JSON file |
| `relayorb replay <session-or-file>` | Serve recorded answers as a fake MCP server |
| `relayorb check <session-or-file> -- <server...>` | Diff a live server against a recording |
| `relayorb diff <run-a> <run-b>` | Find the first tool call where two runs diverged |
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
