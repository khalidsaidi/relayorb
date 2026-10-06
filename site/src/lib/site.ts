export const links = {
  github: "https://github.com/khalidsaidi/relayorb",
  releases: "https://github.com/khalidsaidi/relayorb/releases",
  license: "https://github.com/khalidsaidi/relayorb/blob/main/LICENSE",
  securityDoc: "https://github.com/khalidsaidi/relayorb/blob/main/SECURITY.md",
};

export const installCommand = "curl -fsSL https://relayorb.com/install.sh | sh";

export const cargoInstallCommand =
  "cargo install --git https://github.com/khalidsaidi/relayorb relayorb";

export const recordCommand =
  "relayorb record --name fs -- npx -y @modelcontextprotocol/server-filesystem /tmp";

export const mcpConfigExample = `{
  "mcpServers": {
    "filesystem": {
      "command": "relayorb",
      "args": ["record", "--name", "fs", "--", "npx", "-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}`;

export const ciExample = `relayorb check fixtures/fs-session.json -- npx -y @modelcontextprotocol/server-filesystem ./testdata`;

export const ciWorkflowExample = `# 1. Record a session once, then save it as a fixture
relayorb export fs -o fixtures/fs-session.json

# 2. In CI: replay the recorded tool calls against the live server
#    and fail the build if any answer changed
relayorb check fixtures/fs-session.json -- npx -y @modelcontextprotocol/server-filesystem ./testdata`;

export type Command = {
  usage: string;
  summary: string;
};

export const commands: Command[] = [
  {
    usage: "relayorb record [--name NAME] -- <mcp server command...>",
    summary:
      "Wrap any stdio MCP server. Point your agent config at relayorb instead of the server; every request and response is recorded.",
  },
  {
    usage: "relayorb list",
    summary: "List recorded sessions.",
  },
  {
    usage: "relayorb show <session> [--json]",
    summary:
      "Show a session timeline: method, tool name, latency, and errors for each message.",
  },
  {
    usage: "relayorb export <session> -o session.json",
    summary: "Save a session as a JSON fixture you can commit to your repo.",
  },
  {
    usage: "relayorb replay <session-or-file>",
    summary:
      "Act as a fake MCP server that answers from the recording: no API keys, no network, same answers every time.",
  },
  {
    usage: "relayorb check <session-or-file> -- <mcp server command...>",
    summary:
      "Re-send the recorded tool calls to the live server and diff the answers. Exits non-zero on a mismatch.",
  },
  {
    usage: "relayorb diff <run-a> <run-b>",
    summary:
      "Compare two runs and show the first tool call where they diverged: a different tool, different arguments, or a different answer, plus each run's agent and server versions.",
  },
];

export type Audience = {
  who: string;
  problem: string;
  answer: string;
  command: string;
};

// Ordered by how much RelayOrb helps: MCP server authors get the most out of it.
export const audiences: Audience[] = [
  {
    who: "You build an MCP server",
    problem:
      "A refactor quietly changes a tool's output or schema, and agents that relied on it start failing. Unit tests don't catch it because they don't speak the protocol.",
    answer:
      "Record one real session with an agent, commit it, and run relayorb check in CI. Every build is compared against the recording, and the job fails if any answer changed.",
    command: "relayorb check fixtures/session.json -- node dist/server.js",
  },
  {
    who: "You build an agent or app that uses MCP tools",
    problem:
      "Your tests hit real tools: they need API keys, cost money, are slow, and return different answers each run.",
    answer:
      "Replay a recorded session instead of the real server. Your agent gets the same answers every time, offline, with no keys.",
    command: "relayorb replay fixtures/session.json",
  },
  {
    who: "A tool call went wrong and you need the raw messages",
    problem:
      "The server hung, returned something malformed, or the agent sent bad arguments, and your agent app only shows a summary.",
    answer:
      "Record the session and read the exact JSON-RPC traffic: every request, response, error, and how long each took. Compare it with a run that worked to see the first call where they went different ways.",
    command: "relayorb diff my-server~1 my-server",
  },
];
