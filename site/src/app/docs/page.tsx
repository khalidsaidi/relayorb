import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { JsonLd } from "@/components/JsonLd";
import { guides } from "@/lib/guides";
import { breadcrumbs, siteName, siteUrl } from "@/lib/seo";
import { cargoInstallCommand, commands, installCommand, links } from "@/lib/site";

const title = "RelayOrb docs: record, replay & test MCP servers";
const description =
  "RelayOrb documentation: install, record MCP tool calls from any agent, inspect sessions, replay them offline, and regression-test MCP servers in CI.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/docs" },
  openGraph: { url: "/docs", title, description, type: "article", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
};

const agentGuides = ["claude-code-mcp", "cursor-mcp", "codex-mcp", "claude-desktop-mcp", "github-mcp-server"];

const sections = [
  {
    id: "record",
    heading: "Record",
    body: "Put relayorb record -- in front of any stdio MCP server command, wherever your agent's config starts the server. RelayOrb launches the real server, forwards every byte unchanged in both directions, and saves each JSON-RPC message with its timestamp. Each time the agent starts the server, a new session is recorded.",
    code: "relayorb record --name fs -- npx -y @modelcontextprotocol/server-filesystem ~/notes",
  },
  {
    id: "inspect",
    heading: "Inspect",
    body: "relayorb list shows sessions, newest first. relayorb show <session> prints every request with its latency and outcome: ok, error (JSON-RPC error), tool error (isError: true), or no answer. Add --json for the full params and responses. Anywhere a session is expected you can use its --name (the newest session with that name), its id, or a unique id prefix.",
    code: "relayorb list\nrelayorb show fs\nrelayorb show fs --json | jq '.calls[] | {label, status, latency_ms}'",
  },
  {
    id: "replay",
    heading: "Replay",
    body: "relayorb replay <session-or-file> acts as the MCP server and answers from the recording, so agents and tests run offline with the same answers every time. Requests are matched by method and params (key order and _meta ignored), then by method and tool name, in recorded order. Anything never recorded gets a JSON-RPC error instead of a hang.",
    code: "relayorb export fs -o fixtures/fs.json\nrelayorb replay fixtures/fs.json",
  },
  {
    id: "check",
    heading: "Check (CI)",
    body: "relayorb check <session-or-file> -- <server command> starts the server, repeats the handshake, re-sends each recorded request, and diffs the answers. Exit code 0 means everything matched, 1 means an answer changed, and 2 means the server couldn't start or initialize. Use --ignore-key <name> (repeatable) for fields that change every run, and --timeout <seconds> for slow servers.",
    code: "relayorb check fixtures/fs.json --ignore-key timestamp -- npx -y @modelcontextprotocol/server-filesystem ./testdata",
  },
];

export default function DocsPage() {
  return (
    <div className="relative min-h-screen text-slate-100">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: title,
          description,
          url: `${siteUrl}/docs`,
          publisher: { "@type": "Organization", name: siteName, url: siteUrl },
        }}
      />
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Docs", path: "/docs" }])} />
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
        <h1 className="text-3xl font-semibold sm:text-5xl">RelayOrb docs</h1>
        <p className="mt-4 text-lg text-slate-300">
          RelayOrb is a flight recorder for AI agents: a single CLI that records the MCP traffic
          between an agent and its tool servers, then lets you inspect, replay, and regression-test it.
        </p>

        <section id="install" className="mt-10 scroll-mt-20">
          <h2 className="text-2xl font-semibold">Install</h2>
          <div className="mt-4 min-w-0">
            <CodeBlock title="macOS / Linux" code={installCommand} snippetId="docs_install" />
          </div>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-sm text-slate-300">
            <li>Installs to <code>~/.local/bin</code>. Set <code>RELAYORB_INSTALL_DIR</code> to change it, or <code>RELAYORB_VERSION</code> to pin a release.</li>
            <li>Windows: download the zip from <a className="text-cyan-200" href={links.releases}>GitHub Releases</a>.</li>
            <li className="break-words">From source: <code>{cargoInstallCommand}</code></li>
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Set up your agent</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-6 text-slate-300">
            {guides
              .filter(g => agentGuides.includes(g.slug))
              .map(g => (
                <li key={g.slug}><Link className="text-cyan-200 hover:text-cyan-100" href={`/guides/${g.slug}`}>{g.h1}</Link></li>
              ))}
          </ul>
        </section>

        {sections.map(section => (
          <section key={section.id} id={section.id} className="mt-10 scroll-mt-20">
            <h2 className="text-2xl font-semibold">{section.heading}</h2>
            <p className="mt-3 text-slate-300">{section.body}</p>
            <div className="mt-4 min-w-0">
              <CodeBlock title={section.heading} code={section.code} snippetId={`docs_${section.id}`} />
            </div>
          </section>
        ))}

        <section id="reference" className="mt-10 scroll-mt-20">
          <h2 className="text-2xl font-semibold">Command reference</h2>
          <ul className="mt-4 divide-y divide-slate-800 rounded-2xl border border-slate-700/70 bg-slate-950/70">
            {commands.map(command => (
              <li key={command.usage} className="p-4">
                <code className="text-sm break-words text-cyan-100">{command.usage}</code>
                <p className="mt-1 text-sm text-slate-300">{command.summary}</p>
              </li>
            ))}
            <li className="p-4">
              <code className="text-sm text-cyan-100">relayorb delete &lt;session&gt;</code>
              <p className="mt-1 text-sm text-slate-300">Delete a recorded session.</p>
            </li>
          </ul>
        </section>

        <section id="storage" className="mt-10 scroll-mt-20">
          <h2 className="text-2xl font-semibold">Storage and privacy</h2>
          <p className="mt-3 text-slate-300">
            Recordings are stored in <code>~/.relayorb/recordings.db</code> (SQLite). Override it
            with <code>--db &lt;path&gt;</code> or <code>RELAYORB_DB</code>. RelayOrb makes no network
            calls of its own. Recordings contain everything the tools received and returned,
            including file contents and secrets passed as arguments, so review exported session
            files before sharing or committing them.
          </p>
          <p className="mt-3 text-slate-300">
            RelayOrb supports the stdio transport used by local MCP servers. Streamable HTTP servers
            aren&apos;t supported yet.
          </p>
        </section>
      </main>
    </div>
  );
}
