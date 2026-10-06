import {
  ArrowRight,
  Bug,
  Database,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { JsonLd } from "@/components/JsonLd";
import { Reveal } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import {
  ciWorkflowExample,
  commands,
  cargoInstallCommand,
  installCommand,
  links,
  mcpConfigExample,
  audiences,
} from "@/lib/site";
import { guides } from "@/lib/guides";
import { faqPage, softwareApplication, website } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const homeFaq = [
  {
    q: "What is RelayOrb?",
    a: "A free, open-source tool that turns real AI agent sessions into tests for MCP servers. It records the messages between an agent (Claude Code, Cursor, Codex, Claude Desktop) and an MCP server, then lets you check new server builds against the recording, replay it so agent tests run offline, or read the raw messages.",
  },
  {
    q: "Do I need RelayOrb just to see what my agent did?",
    a: "Usually not. Claude Code, Cursor, and other agent apps already show tool calls. RelayOrb is for when you need the raw protocol messages, a repeatable test, or an offline replay.",
  },
  {
    q: "How do I see the raw MCP messages my agent sent?",
    a: "Wrap the MCP server command with relayorb record -- in your agent's config, use the agent, then run relayorb show <name>. You get every tool call with its arguments, result, latency, and errors.",
  },
  {
    q: "How do I test an MCP server?",
    a: "Record a real session, export it as a JSON fixture, and run relayorb check <fixture> -- <server command> in CI. It re-sends the recorded calls and fails if any answer changed.",
  },
  {
    q: "Which MCP clients does RelayOrb work with?",
    a: "Any client that starts MCP servers over stdio, including Claude Code, Claude Desktop, Cursor, OpenAI Codex, and VS Code.",
  },
  {
    q: "Does RelayOrb send my data anywhere?",
    a: "No. It has no account, no cloud, and no telemetry. Recordings stay in a local SQLite file at ~/.relayorb/recordings.db.",
  },
  {
    q: "Is RelayOrb free?",
    a: "Yes. It is open source under the Apache-2.0 license, with prebuilt binaries for macOS, Linux, and Windows.",
  },
];

const audienceIcons = [ShieldCheck, FlaskConical, Bug];

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-1 text-slate-400 lg:pt-10 lg:pb-0">
      <ArrowRight className="h-5 w-5 rotate-90 text-cyan-300 lg:rotate-0" aria-hidden />
      <span className="text-[11px] tracking-[0.12em] uppercase">{label}</span>
    </div>
  );
}

function FlowDiagram() {
  return (
    <figure className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4 sm:p-6">
      <figcaption className="sr-only">
        An AI agent talks to relayorb over stdio, relayorb forwards each message
        to the MCP server, and every request and response is recorded to a local
        SQLite file.
      </figcaption>
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:gap-4">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
          <p className="text-xs tracking-[0.14em] text-slate-400 uppercase">Agent</p>
          <p className="mt-1 font-medium text-slate-100">Your MCP client</p>
          <p className="mt-1 text-sm text-slate-400">
            Claude Desktop, Claude Code, Cursor, or any MCP client
          </p>
        </div>

        <FlowArrow label="stdio" />

        <div className="flex flex-col items-stretch">
          <div className="rounded-xl border border-cyan-300/50 bg-cyan-400/10 p-4 shadow-[0_0_40px_-12px_rgba(88,198,255,0.6)]">
            <p className="text-xs tracking-[0.14em] text-cyan-300 uppercase">Recorder</p>
            <p className="mt-1 font-mono font-medium text-cyan-100">relayorb record</p>
            <p className="mt-1 text-sm text-slate-300">
              Relays every JSON-RPC message unchanged and keeps a copy
            </p>
          </div>
          <div className="mx-auto h-6 w-px bg-gradient-to-b from-cyan-300/70 to-indigo-300/60" aria-hidden />
          <div className="flex items-start gap-3 rounded-xl border border-indigo-300/40 bg-indigo-400/10 p-4">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-indigo-200" aria-hidden />
            <div className="min-w-0">
              <p className="font-medium text-indigo-100">Local SQLite file</p>
              <p className="mt-1 text-sm break-words text-slate-300">
                <code>~/.relayorb/recordings.db</code>
              </p>
            </div>
          </div>
        </div>

        <FlowArrow label="stdio" />

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-4">
          <p className="text-xs tracking-[0.14em] text-slate-400 uppercase">Tools</p>
          <p className="mt-1 font-medium text-slate-100">MCP server</p>
          <p className="mt-1 text-sm text-slate-400">
            Any MCP server that runs over stdio, unmodified
          </p>
        </div>
      </div>
    </figure>
  );
}

export default function HomePage() {
  return (
    <div className="relative min-h-screen text-slate-100">
      <JsonLd data={softwareApplication} />
      <JsonLd data={website} />
      <JsonLd data={faqPage(homeFaq)} />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <section className="pt-16 pb-10 sm:pt-24" data-analytics-section="home_hero">
          <div>
            <p className="mb-4 text-xs tracking-[0.22em] text-cyan-300 uppercase">
              Free · Open source · Runs on your machine
            </p>
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
              RelayOrb
              <span className="mt-3 block text-2xl font-normal text-slate-100 sm:text-3xl">
                Turn real AI agent sessions into tests for MCP servers.
              </span>
            </h1>
            <p className="mt-6 max-w-3xl text-base text-slate-300 sm:text-lg">
              RelayOrb records the messages between an AI agent (Claude Code,
              Cursor, Codex, Claude Desktop) and an MCP server. Save a
              recording, and RelayOrb can check every new build of the server
              against it, or replay it so agent tests run without the real
              server.
            </p>

            <div className="mt-8 max-w-3xl min-w-0">
              <CodeBlock title="Install" code={installCommand} snippetId="copy_install" />
              <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                <li>
                  macOS and Linux: the script above downloads the prebuilt
                  binary to <code className="text-slate-200">~/.local/bin</code>.
                </li>
                <li className="break-words">
                  npm (any OS):{" "}
                  <code className="text-slate-200">npm install -g @khalidsaidi/relayorb</code>, or
                  run it without installing via{" "}
                  <code className="text-slate-200">npx @khalidsaidi/relayorb</code>.
                </li>
                <li>
                  Windows: download the zip from{" "}
                  <TrackedLink
                    href={links.releases}
                    variant="link"
                    eventName="outbound_click"
                    eventParams={{ destination: "github.com/khalidsaidi/relayorb/releases", location: "hero" }}
                  >
                    GitHub Releases
                  </TrackedLink>
                  .
                </li>
                <li className="break-words">
                  From source:{" "}
                  <code className="text-slate-200">{cargoInstallCommand}</code>
                </li>
              </ul>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <TrackedLink
                href={links.github}
                variant="primary"
                eventName="cta_click"
                eventParams={{ cta: "view_github", location: "hero" }}
              >
                View on GitHub
              </TrackedLink>
              <TrackedLink
                href="#quickstart"
                variant="ghost"
                eventName="cta_click"
                eventParams={{ cta: "quickstart", location: "hero" }}
              >
                Quickstart
              </TrackedLink>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Tested on Linux, macOS, and Windows against 7 real MCP servers and 10 stress tests.{" "}
              <TrackedLink
                href="/testing"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "test_results", location: "hero" }}
              >
                See the results
              </TrackedLink>
            </p>
          </div>
        </section>

        <section id="who" className="scroll-mt-20 py-8" data-analytics-section="home_audiences">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Who it&apos;s for</h2>
          </Reveal>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {audiences.map(({ who, problem, answer, command }, index) => {
              const Icon = audienceIcons[index] ?? Bug;
              return (
                <Reveal key={who}>
                  <article className="flex h-full flex-col rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
                    <Icon className="mb-3 h-5 w-5 text-cyan-300" aria-hidden />
                    <h3 className="text-lg font-medium">{who}</h3>
                    <p className="mt-3 text-sm text-slate-400">
                      <span className="font-medium text-slate-300">The problem: </span>
                      {problem}
                    </p>
                    <p className="mt-3 text-sm text-slate-300">
                      <span className="font-medium text-cyan-200">RelayOrb: </span>
                      {answer}
                    </p>
                    <code className="mt-4 block rounded-lg bg-slate-900/80 px-3 py-2 text-xs break-words text-cyan-100">
                      {command}
                    </code>
                  </article>
                </Reveal>
              );
            })}
          </div>
          <Reveal>
            <div className="mt-6 rounded-2xl border border-slate-700/70 bg-slate-900/40 p-5 text-sm text-slate-300">
              <p className="font-medium text-slate-100">When you don&apos;t need it</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  You just want to see what your agent did once. Claude Code, Cursor,
                  and other agent apps already show tool calls and results.
                </li>
                <li>
                  Your MCP server is remote (HTTP). RelayOrb works with local servers
                  that run over stdio, which is how most MCP servers run today.
                </li>
              </ul>
            </div>
          </Reveal>
        </section>

        <section className="py-8" data-analytics-section="home_how">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
            <ol className="mt-4 max-w-3xl list-decimal space-y-1.5 pl-6 text-slate-300">
              <li><span className="text-slate-100">Record:</span> put <code className="text-cyan-200">relayorb record --</code> in front of the server command in your agent&apos;s config, and use the agent normally.</li>
              <li><span className="text-slate-100">Save:</span> <code className="text-cyan-200">relayorb export</code> writes the session to a JSON file you can commit.</li>
              <li><span className="text-slate-100">Use it:</span> <code className="text-cyan-200">relayorb check</code> tests a server build against it, <code className="text-cyan-200">relayorb replay</code> stands in for the server, and <code className="text-cyan-200">relayorb show</code> lets you read it.</li>
            </ol>
            <p className="mt-4 max-w-3xl text-slate-300">
              Point your agent config at <code className="text-cyan-200">relayorb</code>{" "}
              instead of the MCP server. RelayOrb starts the real server, relays
              traffic both ways, and records each request and response with
              its timing.
            </p>
          </Reveal>
          <div className="mt-6">
            <Reveal>
              <FlowDiagram />
            </Reveal>
          </div>
        </section>



        <section id="quickstart" className="scroll-mt-20 py-8" data-analytics-section="home_quickstart">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Record your agent</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              Wrap any stdio MCP server by putting{" "}
              <code className="text-cyan-200">relayorb record --</code> in front of
              its command. This works in Claude Desktop, Claude Code, Cursor, and
              any other MCP client config.
            </p>
          </Reveal>
          <div className="mt-5 min-w-0">
            <Reveal>
              <CodeBlock
                title="MCP client config (e.g. claude_desktop_config.json)"
                code={mcpConfigExample}
                snippetId="copy_mcp_config"
              />
            </Reveal>
          </div>
          <Reveal>
            <p className="mt-3 text-sm text-slate-400">
              Then use the agent as usual and run{" "}
              <code className="text-slate-200">relayorb list</code> and{" "}
              <code className="text-slate-200">relayorb show fs</code> to see what
              happened.
            </p>
          </Reveal>
        </section>

        <section id="commands" className="scroll-mt-20 py-8" data-analytics-section="home_commands">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Commands</h2>
          </Reveal>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70">
            <ul className="divide-y divide-slate-800">
              {commands.map(command => (
                <li key={command.usage} className="grid gap-2 p-4 sm:p-5 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-6">
                  <code className="min-w-0 text-sm break-words text-cyan-100">
                    {command.usage}
                  </code>
                  <p className="text-sm text-slate-300">{command.summary}</p>
                </li>
              ))}
            </ul>
          </div>
          <Reveal>
            <p className="mt-3 text-sm text-slate-400">
              Recordings live in <code className="text-slate-200">~/.relayorb/recordings.db</code>.
              Set <code className="text-slate-200">RELAYORB_DB</code> to use a different file.
            </p>
          </Reveal>
        </section>

        <section id="ci" className="scroll-mt-20 py-8" data-analytics-section="home_ci">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Regression-test MCP servers in CI</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              Export a known-good session as a fixture and commit it. In CI,{" "}
              <code className="text-cyan-200">relayorb check</code> re-sends the
              recorded tool calls to the live server, diffs the answers, and
              exits non-zero on a mismatch.
            </p>
          </Reveal>
          <div className="mt-5 min-w-0">
            <Reveal>
              <CodeBlock title="CI step" code={ciWorkflowExample} snippetId="copy_ci_example" />
            </Reveal>
          </div>
          <Reveal>
            <p className="mt-3 max-w-3xl text-sm text-slate-400">
              Need the opposite? <code className="text-slate-200">relayorb replay fixtures/fs-session.json</code>{" "}
              stands in for the real server so agent tests run offline with the
              same answers every time.
            </p>
          </Reveal>
        </section>
        <section id="guides" className="scroll-mt-20 py-8" data-analytics-section="home_guides">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Guides</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              Set up MCP servers in your agent and see exactly what they do.
            </p>
          </Reveal>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {guides.map(guide => (
              <li key={guide.slug}>
                <Link
                  href={`/guides/${guide.slug}`}
                  className="block h-full rounded-xl border border-slate-700/70 bg-slate-950/70 p-4 transition hover:border-cyan-300/60"
                >
                  <span className="font-medium text-slate-100">{guide.h1}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section id="faq" className="scroll-mt-20 py-8" data-analytics-section="home_faq">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">FAQ</h2>
          </Reveal>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            {homeFaq.map(({ q, a }) => (
              <div key={q} className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
                <dt className="font-medium text-slate-100">{q}</dt>
                <dd className="mt-2 text-sm text-slate-300">{a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
