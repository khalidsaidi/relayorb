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
];

export const useCases = [
  {
    title: "Debug a weird agent run",
    body: "See exactly which tools the agent called, with what arguments, what came back, how long it took, and where it failed.",
  },
  {
    title: "Reproduce a bug",
    body: "Replay the recorded session so the agent sees the exact same tool answers that triggered the problem.",
  },
  {
    title: "Test without real APIs",
    body: "Run agents and tests against a recording instead of live or paid services. Deterministic, offline, no keys.",
  },
  {
    title: "Catch MCP server regressions in CI",
    body: "Commit a session fixture and run relayorb check in CI. The job fails when the server's answers drift.",
  },
];

