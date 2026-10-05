// SEO guide pages. Topics come from Google Trends research (2025-10 → 2026-10):
// "MCP server" dominates; "github mcp", "what is mcp", "claude code mcp", "cursor mcp",
// and "codex mcp" are the largest (and rising) related searches. Each guide answers that
// search honestly and shows where RelayOrb helps.

export type GuideSection = {
  heading: string;
  body: string[];
  code?: { title: string; code: string };
  list?: string[];
};

export type Faq = { q: string; a: string };

export type Guide = {
  slug: string;
  /** <title>, kept under ~60 characters. */
  title: string;
  h1: string;
  /** Meta description, ~150 characters. */
  description: string;
  keywords: string[];
  intro: string;
  sections: GuideSection[];
  faq: Faq[];
  updated: string;
};

const fsServer = "npx -y @modelcontextprotocol/server-filesystem";

export const guides: Guide[] = [
  {
    slug: "what-is-mcp",
    title: "What is MCP? What is an MCP server? (Plain-English guide)",
    h1: "What is MCP, and what is an MCP server?",
    description:
      "MCP (Model Context Protocol) is the open standard that lets AI agents like Claude, Cursor, and Codex use tools. Here's what an MCP server is and how it works.",
    keywords: ["what is mcp", "what is mcp server", "mcp server meaning", "model context protocol", "mcp server"],
    intro:
      "MCP, the Model Context Protocol, is an open standard for connecting AI agents to tools and data. An MCP server is a small program that exposes tools (like \"read a file\" or \"create a GitHub issue\") that any MCP-compatible agent can call.",
    sections: [
      {
        heading: "MCP in one paragraph",
        body: [
          "Before MCP, every AI app had to write its own integration for every tool. MCP standardizes that connection: a tool author writes one MCP server, and it works in Claude Code, Claude Desktop, Cursor, Codex, VS Code, and every other MCP client. Anthropic introduced MCP in November 2024 as an open protocol, and it has since been adopted across the industry.",
        ],
      },
      {
        heading: "What an MCP server actually is",
        body: [
          "An MCP server is a regular program. The agent (the MCP client) starts it and talks to it with JSON-RPC 2.0 messages. A server can offer three kinds of things:",
        ],
        list: [
          "Tools: functions the agent can call, such as read_file, search_issues, or query_database.",
          "Resources: data the agent can read, such as files, documents, or records.",
          "Prompts: reusable prompt templates the user can pick from.",
        ],
      },
      {
        heading: "How the agent and the server talk",
        body: [
          "Local MCP servers usually run over stdio: the client launches the server as a subprocess and they exchange one JSON message per line on stdin and stdout. Remote servers use Streamable HTTP instead. A typical session looks like this: initialize, tools/list to discover the tools, then a series of tools/call requests while the agent works.",
        ],
        code: {
          title: "A tools/call request and its response",
          code: `→ {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"read_text_file","arguments":{"path":"notes/todo.txt"}}}
← {"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"buy milk"}]}}`,
        },
      },
      {
        heading: "Seeing it for yourself",
        body: [
          "The fastest way to understand MCP is to watch real traffic. RelayOrb is a free, open-source recorder that sits between your agent and an MCP server and saves every message. Wrap any server with relayorb record, use your agent normally, then run relayorb show to see each call, its arguments, the answer, and how long it took.",
        ],
        code: {
          title: "Record an MCP server and inspect the session",
          code: `relayorb record --name fs -- ${fsServer} ~/notes
relayorb show fs`,
        },
      },
    ],
    faq: [
      {
        q: "What does MCP stand for?",
        a: "Model Context Protocol. It is an open protocol for connecting AI models and agents to external tools and data sources.",
      },
      {
        q: "Is an MCP server a web server?",
        a: "Not necessarily. Most local MCP servers are command-line programs that the agent starts and talks to over stdin/stdout (the stdio transport). Remote MCP servers use HTTP.",
      },
      {
        q: "Which apps support MCP?",
        a: "Claude Code, Claude Desktop, Cursor, OpenAI Codex, VS Code, Windsurf, and many other agents and IDEs support MCP servers.",
      },
      {
        q: "How can I see what an MCP server is doing?",
        a: "Put a recorder like RelayOrb in front of it. RelayOrb relays the traffic unchanged and saves every request and response so you can inspect, replay, or test it later.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "claude-code-mcp",
    title: "Claude Code MCP: add servers and see every tool call",
    h1: "Claude Code MCP servers: add them, then see every tool call",
    description:
      "How to add MCP servers to Claude Code with claude mcp add, where the config lives, and how to record every tool call Claude Code makes so you can debug it.",
    keywords: ["claude code mcp", "claude mcp server", "claude code mcp server", "claude mcp add", "claude code mcp config"],
    intro:
      "Claude Code can use any MCP server as a source of tools. This guide shows how to add one, where the configuration is stored, and how to record exactly what Claude Code sends to the server and what comes back.",
    sections: [
      {
        heading: "Add an MCP server to Claude Code",
        body: [
          "Use claude mcp add with a name, then -- and the command that starts the server. Claude Code launches the server over stdio when a session starts.",
        ],
        code: {
          title: "Add the filesystem MCP server",
          code: `claude mcp add fs -- ${fsServer} ~/notes
claude mcp list`,
        },
      },
      {
        heading: "Where the configuration lives",
        body: [
          "By default, claude mcp add stores the server for you in your local project scope. Add --scope project to write it to a .mcp.json file at the repository root, which you can commit and share with your team, or --scope user to make it available in every project.",
        ],
      },
      {
        heading: "See every tool call Claude Code makes",
        body: [
          "When Claude Code does something surprising with a tool, you want the exact request and response. Put relayorb record -- in front of the server command. RelayOrb starts the real server, passes every message through unchanged, and records each one to a local SQLite file.",
        ],
        code: {
          title: "Add the server through RelayOrb",
          code: `claude mcp add fs -- relayorb record --name fs -- ${fsServer} ~/notes`,
        },
      },
      {
        heading: "Inspect the session",
        body: [
          "After you use Claude Code, list the recorded sessions and open the latest one by name. Each line shows the method, tool name, latency, and whether it succeeded or returned a tool error. Add --json to get the full arguments and responses.",
        ],
        code: {
          title: "Session timeline",
          code: `$ relayorb show fs
    2.064s  ->  initialize                                 5ms  ok
    2.074s  ->  tools/list                                10ms  ok
    5.842s  ->  tools/call list_directory                  4ms  ok
    8.053s  ->  tools/call read_multiple_files             3ms  ok`,
        },
      },
      {
        heading: "Turn a session into a test",
        body: [
          "Export a good session and commit it. relayorb check re-sends the recorded calls to the server and fails if any answer changed, and relayorb replay stands in for the server so tests run offline.",
        ],
        code: {
          title: "Regression-check the server",
          code: `relayorb export fs -o fixtures/fs.json
relayorb check fixtures/fs.json -- ${fsServer} ./testdata`,
        },
      },
    ],
    faq: [
      {
        q: "How do I add an MCP server to Claude Code?",
        a: "Run claude mcp add <name> -- <command> [args...]. Use --scope project to share it through a committed .mcp.json file.",
      },
      {
        q: "How do I debug an MCP server in Claude Code?",
        a: "Wrap the server command with relayorb record -- so every request and response is saved, then run relayorb show <name> to see each tool call, its latency, and its result.",
      },
      {
        q: "Does recording slow Claude Code down?",
        a: "Barely. RelayOrb forwards each line as soon as it arrives and writes the copy to SQLite on a separate thread.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "cursor-mcp",
    title: "Cursor MCP: set up servers in mcp.json and debug tool calls",
    h1: "Cursor MCP: configure servers in mcp.json and see what they do",
    description:
      "How to add MCP servers to Cursor with mcp.json (global or per project), and how to record every MCP tool call Cursor's agent makes so you can debug it.",
    keywords: ["cursor mcp", "cursor mcp server", "cursor mcp.json", "cursor mcp config"],
    intro:
      "Cursor's agent can call tools from any MCP server you configure. This guide covers the mcp.json format, where to put it, and how to record the agent's tool calls when something goes wrong.",
    sections: [
      {
        heading: "Where Cursor reads MCP servers from",
        body: [
          "Cursor reads MCP servers from ~/.cursor/mcp.json for all projects, and from .cursor/mcp.json in a project folder for that project only. Each entry gives the command that starts the server and its arguments.",
        ],
        code: {
          title: ".cursor/mcp.json",
          code: `{
  "mcpServers": {
    "fs": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]
    }
  }
}`,
        },
      },
      {
        heading: "Record every tool call",
        body: [
          "To see exactly what Cursor's agent sends and receives, make relayorb the command and move the real server after --. Use the absolute path to relayorb, because desktop apps don't always inherit your shell's PATH. Run which relayorb to find it.",
        ],
        code: {
          title: ".cursor/mcp.json with RelayOrb",
          code: `{
  "mcpServers": {
    "fs": {
      "command": "/Users/you/.local/bin/relayorb",
      "args": ["record", "--name", "cursor-fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]
    }
  }
}`,
        },
      },
      {
        heading: "Inspect what happened",
        body: [
          "Use the agent as usual, then open a terminal. relayorb list shows each recorded session, and relayorb show cursor-fs prints the timeline of calls with latency and errors. MCP tool failures (results with isError: true) are flagged as tool errors.",
        ],
        code: { title: "Terminal", code: "relayorb list\nrelayorb show cursor-fs" },
      },
    ],
    faq: [
      {
        q: "Where is Cursor's MCP config file?",
        a: "~/.cursor/mcp.json for global servers, or .cursor/mcp.json inside a project for project-specific servers.",
      },
      {
        q: "Why does Cursor say my MCP server failed to start?",
        a: "Often the command isn't on the PATH Cursor sees. Use an absolute path for the command, and check the server's own error output.",
      },
      {
        q: "Can I test my MCP server without Cursor?",
        a: "Yes. Record one session, export it, and run relayorb check against the server in CI. It replays the recorded calls and reports any answer that changed.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "codex-mcp",
    title: "Codex MCP: add MCP servers to OpenAI Codex and record calls",
    h1: "Codex MCP: add servers in config.toml and record every tool call",
    description:
      "How to configure MCP servers for the OpenAI Codex CLI in ~/.codex/config.toml, and how to record and inspect every MCP tool call Codex makes.",
    keywords: ["codex mcp", "codex mcp server", "openai codex mcp", "codex config.toml mcp"],
    intro:
      "The OpenAI Codex CLI can use MCP servers as tools. Servers are configured in ~/.codex/config.toml. Here's the format, plus how to record what Codex sends to each server.",
    sections: [
      {
        heading: "Configure an MCP server for Codex",
        body: [
          "Add an [mcp_servers.<name>] table with the command and its arguments. Codex starts the server over stdio.",
        ],
        code: {
          title: "~/.codex/config.toml",
          code: `[mcp_servers.fs]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]`,
        },
      },
      {
        heading: "Record Codex's tool calls",
        body: [
          "Make relayorb the command and put the original server after --. Every request and response is saved to ~/.relayorb/recordings.db.",
        ],
        code: {
          title: "~/.codex/config.toml with RelayOrb",
          code: `[mcp_servers.fs]
command = "relayorb"
args = ["record", "--name", "codex-fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/path/to/project"]`,
        },
      },
      {
        heading: "Inspect, replay, and test",
        body: [
          "relayorb show codex-fs prints every call with timing and outcome. relayorb replay serves the recorded answers so you can rerun a Codex task against the exact same tool results, and relayorb check turns the recording into a regression test for the server.",
        ],
        code: { title: "Terminal", code: "relayorb show codex-fs\nrelayorb export codex-fs -o fixtures/codex-fs.json" },
      },
    ],
    faq: [
      {
        q: "Where do I configure MCP servers for Codex?",
        a: "In ~/.codex/config.toml, using one [mcp_servers.<name>] table per server with command and args.",
      },
      {
        q: "How do I see what Codex sent to an MCP server?",
        a: "Wrap the server with relayorb record -- in config.toml, then run relayorb show <name> after the task.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "claude-desktop-mcp",
    title: "Claude Desktop MCP: claude_desktop_config.json guide",
    h1: "Claude Desktop MCP servers: the config file, and how to see every call",
    description:
      "Where claude_desktop_config.json lives on macOS and Windows, how to add MCP servers to Claude Desktop, and how to record every tool call for debugging.",
    keywords: ["claude desktop mcp", "claude_desktop_config.json", "claude desktop mcp server", "claude mcp server"],
    intro:
      "Claude Desktop loads MCP servers from claude_desktop_config.json. This guide shows where that file is, what goes in it, and how to record every tool call Claude makes.",
    sections: [
      {
        heading: "Where the config file is",
        list: [
          "macOS: ~/Library/Application Support/Claude/claude_desktop_config.json",
          "Windows: %APPDATA%\\Claude\\claude_desktop_config.json",
        ],
        body: [
          "You can also open it from Claude Desktop's settings, in the Developer section. Restart Claude Desktop after editing it.",
        ],
      },
      {
        heading: "Add a server, recorded by RelayOrb",
        body: [
          "Use the absolute path to relayorb as the command, because Claude Desktop doesn't load your shell's PATH. Everything after -- is the original server command.",
        ],
        code: {
          title: "claude_desktop_config.json",
          code: `{
  "mcpServers": {
    "fs": {
      "command": "/Users/you/.local/bin/relayorb",
      "args": ["record", "--name", "desktop-fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/Users/you/notes"]
    }
  }
}`,
        },
      },
      {
        heading: "See what Claude did",
        body: [
          "After a conversation, run relayorb show desktop-fs to get the timeline of tool calls, or relayorb show desktop-fs --json for the complete requests and responses. Claude Desktop's own MCP logs show server output, while RelayOrb shows the protocol messages themselves.",
        ],
        code: { title: "Terminal", code: "relayorb show desktop-fs" },
      },
    ],
    faq: [
      {
        q: "Where is claude_desktop_config.json?",
        a: "On macOS: ~/Library/Application Support/Claude/claude_desktop_config.json. On Windows: %APPDATA%\\Claude\\claude_desktop_config.json.",
      },
      {
        q: "Why isn't my MCP server showing up in Claude Desktop?",
        a: "Check that the JSON is valid, that the command is an absolute path, and that you fully restarted Claude Desktop.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "github-mcp-server",
    title: "GitHub MCP server: set it up and see every tool call",
    h1: "The GitHub MCP server: set it up locally and record what it does",
    description:
      "Run GitHub's official MCP server locally with Docker in Claude Code, Cursor, or Codex, and record every GitHub tool call your agent makes with RelayOrb.",
    keywords: ["github mcp", "github mcp server", "github mcp claude code", "github mcp cursor"],
    intro:
      "GitHub's official MCP server gives agents tools for repositories, issues, pull requests, and more. You can run it locally over stdio with Docker. Because it acts on real repositories, it's worth recording exactly what your agent asks it to do.",
    sections: [
      {
        heading: "Run the GitHub MCP server locally",
        body: [
          "The local version runs as a Docker container and reads a GitHub personal access token from the environment. Give the token only the scopes you need.",
        ],
        code: {
          title: "Claude Code",
          code: `claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=<your-token> -- \\
  docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`,
        },
      },
      {
        heading: "Record every GitHub action your agent takes",
        body: [
          "Wrap the docker command with relayorb record --. You get a timeline of every search, issue, and pull-request call, with the full arguments and responses.",
        ],
        code: {
          title: "Claude Code, recorded",
          code: `claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=<your-token> -- \\
  relayorb record --name github -- \\
  docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server`,
        },
      },
      {
        heading: "Review it",
        body: [
          "relayorb show github lists each call, for example tools/call search_issues or tools/call create_pull_request, with latency and errors. Recordings contain the data the server returned, so treat them like the repository data they hold.",
        ],
        code: { title: "Terminal", code: "relayorb show github" },
      },
    ],
    faq: [
      {
        q: "Is there an official GitHub MCP server?",
        a: "Yes. GitHub publishes github/github-mcp-server, which runs locally (for example with Docker) or as a hosted remote server.",
      },
      {
        q: "Can RelayOrb record the remote GitHub MCP server?",
        a: "Not yet. RelayOrb records stdio servers, so use the local Docker version to record traffic.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "test-mcp-server",
    title: "How to test an MCP server (record, replay, CI)",
    h1: "How to test an MCP server: record real sessions, check them in CI",
    description:
      "A practical way to regression-test MCP servers: record a real agent session, commit it as a fixture, and diff the live server's answers in CI with relayorb check.",
    keywords: ["test mcp server", "mcp testing", "mcp server testing", "mcp regression test", "mcp server ci"],
    intro:
      "Unit tests cover your functions, but the thing that breaks agents is the protocol surface: tool schemas, result shapes, error behavior. The most realistic test input is a session a real agent actually produced. Record one, then check every future build against it.",
    sections: [
      {
        heading: "1. Record a real session",
        body: ["Point your agent at the server through RelayOrb and do the task you care about."],
        code: { title: "Record", code: "relayorb record --name my-server -- node dist/server.js" },
      },
      {
        heading: "2. Save it as a fixture",
        body: [
          "Export the session to a JSON file and commit it. Review it first: recordings contain everything the tools returned.",
        ],
        code: { title: "Export", code: "relayorb export my-server -o tests/fixtures/session.json" },
      },
      {
        heading: "3. Check the server in CI",
        body: [
          "relayorb check starts the server, replays the handshake, re-sends every recorded call, and diffs each answer. It exits 0 when everything matches, 1 when an answer changed, and 2 if the server couldn't start. Use --ignore-key for fields that change on every run, like timestamps.",
        ],
        code: {
          title: "GitHub Actions step",
          code: `- name: MCP regression check
  run: |
    curl -fsSL https://relayorb.com/install.sh | sh
    ~/.local/bin/relayorb check tests/fixtures/session.json --ignore-key timestamp -- node dist/server.js`,
        },
      },
      {
        heading: "4. Test agents without the real server",
        body: [
          "The reverse also works. relayorb replay pretends to be the server and answers from the recording, so agent tests run offline, without API keys, and get the same answers every time.",
        ],
        code: { title: "Replay", code: "relayorb replay tests/fixtures/session.json" },
      },
    ],
    faq: [
      {
        q: "What does relayorb check compare?",
        a: "The result or error of each recorded request, after dropping the JSON-RPC id and any keys you pass with --ignore-key. Differences are printed as path: old -> new.",
      },
      {
        q: "Does it test tools/list too?",
        a: "Yes. Every recorded request except initialize and ping is re-sent, so tool schema changes show up as failures.",
      },
    ],
    updated: "2026-10-05",
  },
  {
    slug: "debug-mcp-server",
    title: "How to debug an MCP server: see every request and response",
    h1: "How to debug an MCP server: see every request and response",
    description:
      "Debug MCP servers by recording the exact JSON-RPC traffic between your agent and the server: arguments, results, tool errors, and latency for every call.",
    keywords: ["debug mcp server", "mcp debugging", "mcp server logs", "mcp inspector alternative"],
    intro:
      "When an agent misuses a tool or a server returns something odd, logs from either side rarely tell the whole story. The protocol messages do. Here's how to capture them without changing the server or the agent.",
    sections: [
      {
        heading: "Capture the real traffic",
        body: [
          "Insert RelayOrb between the client and the server. It forwards bytes unchanged and records every message, including server-to-client requests and notifications. Anything the server writes to stderr still goes to the client's logs.",
        ],
        code: { title: "Wrap the server", code: "relayorb record --name dbg -- python -m my_mcp_server" },
      },
      {
        heading: "Read the timeline",
        body: [
          "relayorb show dbg lists each request with its latency and outcome: ok, error (a JSON-RPC error), or tool error (a result with isError: true). Unanswered requests show as no answer, which points straight at hangs.",
        ],
      },
      {
        heading: "Dig into a single call",
        body: ["The JSON view has the full params and response for every call. Pipe it to jq to filter."],
        code: {
          title: "Find failing tool calls",
          code: `relayorb show dbg --json | jq '.calls[] | select(.status != "ok") | {label, params, response}'`,
        },
      },
      {
        heading: "Reproduce it",
        body: [
          "Export the session and replay it to get the same answers again, or run relayorb check against a fixed build to confirm the bug is gone.",
        ],
      },
    ],
    faq: [
      {
        q: "How is this different from MCP Inspector?",
        a: "MCP Inspector is an interactive UI for calling a server by hand. RelayOrb records what a real agent actually did, so you can debug, replay, and test real sessions.",
      },
      {
        q: "Will recording change how the server behaves?",
        a: "No. Bytes are forwarded unchanged in both directions. Recording happens on a copy, on a separate thread.",
      },
    ],
    updated: "2026-10-05",
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find(g => g.slug === slug);
}
