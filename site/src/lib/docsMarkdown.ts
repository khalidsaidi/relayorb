import {
  cargoInstallCommand,
  ciExample,
  commands,
  installCommand,
  links,
  mcpConfigExample,
  useCases,
} from "@/lib/site";

const commandList = commands
  .map(command => `- \`${command.usage}\`: ${command.summary}`)
  .join("\n");

const useCaseList = useCases
  .map((useCase, index) => `${index + 1}. **${useCase.title}.** ${useCase.body}`)
  .join("\n");

export const docsMarkdown = `# RelayOrb

A flight recorder for AI agents.

RelayOrb is a single open-source Rust CLI (Apache-2.0) that sits between an AI
agent (Claude Desktop, Claude Code, Cursor, or any MCP client) and its MCP tool
servers over stdio. It records every JSON-RPC message to a local SQLite file and
lets you replay or regression-check those sessions.

It runs locally or in CI. No account, no cloud, no telemetry. Free.

- Website: https://relayorb.com
- Source: ${links.github}
- Releases (prebuilt binaries): ${links.releases}
- Install script: https://relayorb.com/install.sh
- License: Apache-2.0 (${links.license})

## Install

macOS and Linux:

\`\`\`sh
${installCommand}
\`\`\`

The script downloads the prebuilt binary for your platform from GitHub Releases
into \`~/.local/bin\` (override with \`RELAYORB_INSTALL_DIR\`; pin a release with
\`RELAYORB_VERSION\`, e.g. \`v0.2.0\`).

Alternatives:

- Windows: download the zip from ${links.releases}
- From source:

  \`\`\`sh
  ${cargoInstallCommand}
  \`\`\`

## How it works

\`\`\`
agent (MCP client) <--stdio--> relayorb record <--stdio--> MCP server
                                    |
                                    v
                       ~/.relayorb/recordings.db (SQLite)
\`\`\`

Point your agent's MCP config at \`relayorb\` instead of the server. RelayOrb
starts the real server, relays every request and response unchanged, and
records each message with its timing.

## Use cases

${useCaseList}

## Commands

${commandList}

Recordings are stored in \`~/.relayorb/recordings.db\` by default. Set
\`RELAYORB_DB\` to use a different file.

## MCP client config example

Claude Desktop (\`claude_desktop_config.json\`) or any MCP client:

\`\`\`json
${mcpConfigExample}
\`\`\`

Then use the agent as usual and inspect the session:

\`\`\`sh
relayorb list
relayorb show fs
relayorb show fs --json
\`\`\`

## Replay

\`\`\`sh
relayorb export fs -o fixtures/fs-session.json
relayorb replay fixtures/fs-session.json
\`\`\`

\`relayorb replay\` acts as a fake MCP server that answers from the recording, so
agents and tests run deterministically without the real tools: no API keys, no
network, same answers every time. Use it as the \`command\` in an MCP client
config the same way as \`relayorb record\`.

## CI regression check

\`\`\`sh
${ciExample}
\`\`\`

\`relayorb check\` re-sends the recorded tool calls to the live server and diffs
the answers. It exits non-zero on a mismatch, so a CI job fails when an MCP
server's behavior changes.
`;
