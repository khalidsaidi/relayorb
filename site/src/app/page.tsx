import Script from "next/script";
import {
  Activity,
  FileCheck2,
  HeartPulse,
  Lock,
  Radar,
  Route,
} from "lucide-react";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { CodeBlock } from "@/components/CodeBlock";
import { Reveal } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import {
  demoCurl,
  links,
  terraformDemoSnippet,
  terraformProdSnippet,
} from "@/lib/site";

const features = [
  {
    title: "Contract-first validation",
    body: "JSON Schema input/output validation prevents silent payload drift.",
    Icon: FileCheck2,
  },
  {
    title: "Governance and ownership",
    body: "Capability namespaces are governed with explicit ownership boundaries.",
    Icon: Lock,
  },
  {
    title: "Routing and health discovery",
    body: "Gateway selects healthy providers through Registry heartbeats.",
    Icon: Route,
  },
  {
    title: "Idempotency and async jobs",
    body: "Retry-safe invoke behavior and async jobs in full production mode.",
    Icon: Radar,
  },
  {
    title: "Metrics, traces, alerts",
    body: "Prometheus metrics and OTEL traces make tool behavior observable.",
    Icon: Activity,
  },
  {
    title: "Secure by default",
    body: "OIDC in prod with private internals behind Cloud Run IAM.",
    Icon: HeartPulse,
  },
];

const flow = [
  "Agent calls Gateway with capability ID and payload.",
  "Gateway validates auth, policy, and JSON schema contract.",
  "Registry returns healthy provider candidates.",
  "Gateway forwards to Worker and validates response schema.",
  "Metrics/traces are emitted for full request lifecycle visibility.",
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen text-slate-100">
      <main className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-8">
        <section className="pt-24 pb-10" data-analytics-section="home_hero">
          <Reveal>
            <p className="mb-4 text-xs uppercase tracking-[0.22em] text-cyan-300">
              RelayOrb - production-grade tool infrastructure
            </p>
            <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-6xl">
              RelayOrb - Tool Control Plane for AI Agents
            </h1>
            <p className="mt-6 max-w-3xl text-lg text-slate-300 sm:text-xl">
              Route agent calls to versioned capabilities with contracts,
              governance, and observability.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <TrackedLink
                href="/demo"
                variant="primary"
                eventName="cta_click"
                eventParams={{ cta: "try_demo", location: "hero" }}
              >
                Try the Anonymous Demo
              </TrackedLink>
              <TrackedLink
                href="#deploy"
                variant="secondary"
                eventName="cta_click"
                eventParams={{ cta: "deploy_terraform", location: "hero" }}
              >
                Deploy with Terraform
              </TrackedLink>
              <TrackedLink
                href={links.github}
                variant="ghost"
                eventName="cta_click"
                eventParams={{ cta: "view_github", location: "hero" }}
              >
                View on GitHub
              </TrackedLink>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Open Source · Anonymous demo (read-only, rate-limited) · Terraform
              modules · Weekly module smoke CI
            </p>
          </Reveal>

          <div className="mt-10">
            <ArchitectureDiagram />
          </div>
        </section>

        <section className="py-8" data-analytics-section="home_why">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Why RelayOrb</h2>
            <p className="mt-3 max-w-3xl text-slate-300">
              Ad-hoc tool wiring degrades quickly in production. RelayOrb adds
              the control-plane guarantees needed to keep agent tool calls
              reliable and auditable.
            </p>
          </Reveal>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ title, body, Icon }) => (
              <Reveal key={title}>
                <article className="h-full rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
                  <Icon className="mb-3 h-5 w-5 text-cyan-300" aria-hidden />
                  <h3 className="text-lg font-medium">{title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="py-8" data-analytics-section="home_how">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {flow.map(step => (
                <li
                  key={step}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200"
                >
                  {step}
                </li>
              ))}
            </ol>
          </Reveal>
        </section>

        <section className="py-8" data-analytics-section="home_try">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Try it in 30 seconds</h2>
            <p className="mt-2 text-slate-300">
              The anonymous demo is intentionally constrained: read-only,
              allowlisted, and rate-limited. Canonical demo guidance stays in
              <TrackedLink
                href={links.demoDocs}
                variant="link"
                className="ml-1"
                eventName="cta_click"
                eventParams={{ cta: "open_demo_docs", location: "home_try" }}
              >
                docs/DEMO.md
              </TrackedLink>
              .
            </p>
          </Reveal>

          <div className="mt-5">
            <CodeBlock
              title="Demo invoke (rag.search@v1)"
              code={demoCurl}
              snippetId="copy_demo_curl"
            />
            <p className="mt-3 text-sm text-slate-400">
              Demo endpoint may change; canonical URL and examples stay in
              GitHub docs.
            </p>
          </div>
        </section>

        <section
          id="deploy"
          className="py-8"
          data-analytics-section="home_deploy"
        >
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Deploy with Terraform</h2>
            <p className="mt-2 text-slate-300">
              Production and demo postures are available as Terraform Registry
              modules.
            </p>
          </Reveal>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Reveal>
              <article className="rounded-2xl border border-indigo-400/30 bg-slate-950/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">Prod module (OIDC-first)</h3>
                  <TrackedLink
                    href={links.prodModule}
                    variant="secondary"
                    className="text-xs"
                    eventName="cta_click"
                    eventParams={{ cta: "open_module_prod", location: "deploy_prod" }}
                  >
                    Open module
                  </TrackedLink>
                </div>
                <CodeBlock
                  title="khalidsaidi/relayorb/google"
                  code={terraformProdSnippet}
                  snippetId="copy_tf_prod"
                />
              </article>
            </Reveal>

            <Reveal>
              <article className="rounded-2xl border border-cyan-400/30 bg-slate-950/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">Demo module (anonymous posture)</h3>
                  <TrackedLink
                    href={links.demoModule}
                    variant="secondary"
                    className="text-xs"
                    eventName="cta_click"
                    eventParams={{ cta: "open_module_demo", location: "deploy_demo" }}
                  >
                    Open module
                  </TrackedLink>
                </div>
                <CodeBlock
                  title="khalidsaidi/relayorb-demo/google"
                  code={terraformDemoSnippet}
                  snippetId="copy_tf_demo"
                />
              </article>
            </Reveal>
          </div>
        </section>

        <section className="py-8" data-analytics-section="home_trust">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Open source, production-shaped
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200">
                Smokes + conformance harness validate behavior before changes
                ship.
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200">
                Remote Terraform state and deployment verifier keep demo posture
                stable.
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200">
                Weekly Terraform module smoke workflow catches registry/install
                regressions.
              </div>
              <div className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200">
                Runbook-driven operations with clear guardrails for public demo
                safety.
              </div>
            </div>
          </Reveal>
        </section>

        <section className="py-8" data-analytics-section="home_agentability">
          <Reveal>
            <h2 className="text-2xl font-semibold sm:text-3xl">Agentability Report</h2>
            <p className="mt-2 max-w-3xl text-slate-300">
              Public machine-readiness report for relayorb.com.
            </p>
            <div className="mt-5">
              <div
                data-agentability-domain="relayorb.com"
                data-agentability-style="card"
              />
            </div>
          </Reveal>
          <Script src="https://agentability.org/embed/widget.js" async />
        </section>
      </main>
    </div>
  );
}
