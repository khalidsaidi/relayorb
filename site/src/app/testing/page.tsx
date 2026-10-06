import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import results from "@/data/test-results.json";
import { breadcrumbs } from "@/lib/seo";

type Row = Record<string, string>;

const title = `RelayOrb test results: ${results.platforms.length} platforms, real MCP servers`;
const description = `RelayOrb ${results.version} tested against 7 real MCP servers and 10 stress tests on Linux, macOS, and Windows, with the binary and the npm package. Includes bugs found and what is not tested yet.`;

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/testing" },
  openGraph: { url: "/testing", title, description, type: "article", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
};

/** Render `code` spans in plain strings from the results file. */
function Ticks({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((part, i) =>
        i % 2 === 1 ? (
          <code key={i} className="text-cyan-100">
            {part}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Cell({ value }: { value: string }) {
  const tone =
    value === "pass" || /^\d+\/\d+/.test(value) && value.split(" ")[0].split("/")[0] === value.split(" ")[0].split("/")[1]
      ? "text-emerald-300"
      : value === "skipped" || value === "-"
        ? "text-slate-500"
        : "text-rose-300";
  return <td className={`px-3 py-2 text-sm whitespace-nowrap ${tone}`}>{value}</td>;
}

function Table({ head, rows, keys, status = 0 }: { head: string[]; rows: Row[]; keys: string[]; status?: number }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-700/70 bg-slate-950/70">
      <table className="w-full min-w-[36rem] text-left">
        <thead className="border-b border-slate-800 text-xs tracking-wide text-slate-400 uppercase">
          <tr>
            {head.map(h => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rows.map((row, i) => (
            <tr key={i}>
              {keys.map((k, j) =>
                j < keys.length - status ? (
                  <td key={k} className="px-3 py-2 align-top text-sm text-slate-300">
                    <Ticks text={row[k] ?? ""} />
                  </td>
                ) : (
                  <Cell key={k} value={row[k] ?? "-"} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TestingPage() {
  const p = results.platforms;
  const summaryRows = Object.entries(results.summary).map(([name, row]) => ({ name, ...(row as Row) }));
  return (
    <div className="relative min-h-screen text-slate-100">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Test results", path: "/testing" }])} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
        <h1 className="text-3xl font-semibold sm:text-5xl">Test results</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-300">
          RelayOrb <strong>{results.version}</strong>, tested {results.date} on {p.join(", ")}. Every number on
          this page comes from the{" "}
          <a className="text-cyan-200" href="https://github.com/khalidsaidi/relayorb/tree/main/tests/compat">
            compatibility suite
          </a>{" "}
          running on GitHub&apos;s machines.{" "}
          <a className="text-cyan-200" href={results.run_url}>
            See the full CI logs
          </a>
          .
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Summary</h2>
          <Table head={["", ...p]} rows={summaryRows} keys={["name", ...p]} status={p.length} />
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Real MCP servers</h2>
          <p className="mt-3 max-w-3xl text-slate-300">Each server goes through every step:</p>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-sm text-slate-300">
            {results.steps.map(s => (
              <li key={s.step}>
                <strong className="text-slate-100">{s.step}</strong>: <Ticks text={s.meaning} />
              </li>
            ))}
          </ul>
          <Table
            head={["Server", "Runtime", "Exercises", ...p]}
            rows={results.servers as Row[]}
            keys={["package", "runtime", "covers", ...p]}
            status={p.length}
          />
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            <code>time</code> and <code>github</code> return live data (the clock, star counts), so differences are
            expected there; they pass when RelayOrb runs cleanly and pinpoints the changed call. The GitHub server runs
            in Docker, so it is tested on Linux only.
          </p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Stress tests</h2>
          <Table
            head={["Test", "What happened", ...p]}
            rows={results.stress as Row[]}
            keys={["test", "detail", ...p]}
            status={p.length}
          />
          <p className="mt-3 text-sm text-slate-400">SIGTERM and SIGKILL do not exist on Windows, so those two are skipped there.</p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-semibold">Real agents</h2>
          <Table
            head={["Agent", "Setup", "Result", "Date"]}
            rows={results.agents as Row[]}
            keys={["agent", "setup", "result", "date"]}
            status={0}
          />
        </section>

        {"findings" in results && results.findings.length > 0 && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Compatibility notes</h2>
            <p className="mt-1 text-sm text-slate-400">Found while testing agents. Not RelayOrb bugs.</p>
            <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-300">
              {results.findings.map(x => (
                <li key={x}>
                  <Ticks text={x} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {"soak" in results && results.soak && (
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Soak test</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              One recording ({results.soak.relayorb}) kept busy for {results.soak.minutes} minutes: {results.soak.calls.toLocaleString("en-US")} calls
              ({results.soak.large_responses.toLocaleString("en-US")} with 200 KB responses,{" "}
              {results.soak.notifications.toLocaleString("en-US")} notifications).{" "}
              {results.soak.recorded_calls.toLocaleString("en-US")} of {results.soak.calls.toLocaleString("en-US")} recorded.
              Memory: {results.soak.rss_mb_after_warmup} MB after warm-up, {results.soak.rss_mb_end} MB at the end.
              Recordings database: {results.soak.db_mb} MB.{" "}
              <span className={results.soak.passed ? "text-emerald-300" : "text-rose-300"}>
                {results.soak.passed ? "pass" : "FAIL"}
              </span>
            </p>
          </section>
        )}

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
            <h2 className="text-xl font-semibold">Bugs this suite found</h2>
            <p className="mt-1 text-sm text-slate-400">All fixed.</p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {results.fixed.map(x => (
                <li key={x}>
                  <Ticks text={x} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
            <h2 className="text-xl font-semibold">Not tested yet</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
              {results.not_tested.map(x => (
                <li key={x}>
                  <Ticks text={x} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-12 text-sm text-slate-400">
          Run it yourself: <code>python3 tests/compat/harness.py --relayorb target/release/relayorb</code>. Back to{" "}
          <Link className="text-cyan-200" href="/docs">
            the docs
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
