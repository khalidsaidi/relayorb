import {
  ArrowRight,
  Bug,
  Database,
  FlaskConical,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { CodeBlock } from "@/components/CodeBlock";
import { Reveal } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import {
  ciWorkflowExample,
  commands,
  cargoInstallCommand,
  installCommand,
  links,
  mcpConfigExample,
  useCases,
} from "@/lib/site";

const useCaseIcons = [Bug, RotateCcw, FlaskConical, ShieldCheck];

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
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-8">
        <section className="pt-16 pb-10 sm:pt-24" data-analytics-section="home_hero">
          <Reveal>
            <p className="mb-4 text-xs tracking-[0.22em] text-cyan-300 uppercase">
              Open source · Apache-2.0 · Runs locally
            </p>
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
              RelayOrb
            </h1>
            <p className="mt-3 max-w-3xl text-2xl text-slate-100 sm:text-3xl">
              A flight recorder for AI agents.
            </p>
            <p className="mt-6 max-w-3xl text-base text-slate-300 sm:text-lg">
              A single Rust CLI that sits between your agent and its MCP tool
              servers, records every JSON-RPC message to a local SQLite file,
              and lets you replay or regression-check those sessions. No
              account, no cloud, no telemetry. Free.
            </p>

            <div className="mt-8 max-w-3xl min-w-0">
              <CodeBlock title="Install" code={installCommand} snippetId="copy_install" />
              <ul className="mt-3 space-y-1.5 text-sm text-slate-400">
                <li>
                  macOS and Linux: the script above downloads the prebuilt
                  binary to <code className="text-slate-200">~/.local/bin</code>.
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
          </Reveal>
        </section>

        <section className="py-8" data-analytics-section="home_how">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
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

        <section className="py-8" data-analytics-section="home_use_cases">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">What it is for</h2>
          </Reveal>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {useCases.map(({ title, body }, index) => {
              const Icon = useCaseIcons[index] ?? Bug;
              return (
                <Reveal key={title}>
                  <article className="h-full rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
                    <Icon className="mb-3 h-5 w-5 text-cyan-300" aria-hidden />
                    <h3 className="text-lg font-medium">{title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{body}</p>
                  </article>
                </Reveal>
              );
            })}
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
      </main>
    </div>
  );
}
