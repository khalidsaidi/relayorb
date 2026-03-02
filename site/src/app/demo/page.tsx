import { CodeBlock } from "@/components/CodeBlock";
import { TrackedLink } from "@/components/TrackedLink";
import { demoCurl, links } from "@/lib/site";

export const metadata = {
  title: "RelayOrb Demo",
  description:
    "Anonymous RelayOrb demo usage, guardrails, and canonical demo docs.",
};

export default function DemoPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-20 sm:px-8">
      <section data-analytics-section="demo_intro">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">
          Anonymous public demo
        </p>
        <h1 className="mt-2 text-4xl font-semibold">Try RelayOrb now</h1>
        <p className="mt-4 text-slate-300">
          Demo endpoint (current): <code>{links.demoCurrent}</code>
        </p>
        <p className="mt-2 text-slate-300">
          Endpoint can change over time. Canonical source of truth is
          <TrackedLink
            href={links.demoDocs}
            variant="link"
            className="ml-1"
            eventName="cta_click"
            eventParams={{ cta: "open_demo_docs", location: "demo_page" }}
          >
            docs/DEMO.md on main
          </TrackedLink>
          .
        </p>
      </section>

      <section className="mt-8" data-analytics-section="demo_curl">
        <CodeBlock title="Demo curl" code={demoCurl} snippetId="copy_demo_curl" />
      </section>

      <section
        className="mt-8 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-6"
        data-analytics-section="demo_guardrails"
      >
        <h2 className="text-xl font-medium">Guardrails in this demo</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
          <li>Anonymous invoke enabled, with strict caps and edge rate limits.</li>
          <li>Read-only capability allowlist for safe public use.</li>
          <li><code>/v1/submit</code> and job endpoints are disabled.</li>
          <li>Gateway is LB-only; registry/worker remain private via IAM.</li>
        </ul>
      </section>

      <section className="mt-8 flex flex-wrap gap-3" data-analytics-section="demo_cta">
        <TrackedLink
          href={links.github}
          variant="ghost"
          eventName="cta_click"
          eventParams={{ cta: "view_github", location: "demo_page" }}
        >
          View GitHub repo
        </TrackedLink>
        <TrackedLink
          href="/"
          variant="secondary"
          eventName="cta_click"
          eventParams={{ cta: "back_home", location: "demo_page" }}
        >
          Back to landing page
        </TrackedLink>
      </section>
    </main>
  );
}
