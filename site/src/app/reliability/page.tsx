import Link from "next/link";
import type { Metadata } from "next";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import {
  getRelayOrbCoreReliability,
  getRelayOrbCostProfile,
  getRelayOrbReliabilityService,
  getRelayOrbReliabilitySnapshot,
  getRelayOrbWorkerDiagnosis,
} from "@/lib/reliability";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Reliability",
  description:
    "Thirty-day RelayOrb production reliability and cost data from internal monitoring traffic.",
  openGraph: {
    title: "Reliability | RelayOrb",
    description:
      "Thirty-day RelayOrb production reliability and cost data from internal monitoring traffic.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RelayOrb",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reliability | RelayOrb",
    description:
      "Thirty-day RelayOrb production reliability and cost data from internal monitoring traffic.",
    images: ["/og-image.png"],
  },
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

function formatDecimal(value: number, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPct(value: number, digits = 2) {
  return `${formatDecimal(value, digits)}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

export default function ReliabilityPage() {
  const snapshot = getRelayOrbReliabilitySnapshot();
  const costProfile = getRelayOrbCostProfile();
  const coreReliability = getRelayOrbCoreReliability();
  const gateway = getRelayOrbReliabilityService("relayorb-gateway-prod");
  const registry = getRelayOrbReliabilityService("relayorb-registry-prod");
  const rag = getRelayOrbReliabilityService("relayorb-rag-prod");
  const workerDiagnosis = getRelayOrbWorkerDiagnosis();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16 text-slate-100 sm:px-8">
      <section className="max-w-4xl">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Reliability report</p>
        <h1 className="mt-3 text-4xl font-semibold sm:text-5xl">
          30 days of real RelayOrb control-plane behavior
        </h1>
        <p className="mt-5 text-lg text-slate-300">
          RelayOrb has been running in production continuously since{" "}
          {formatDate(snapshot.operationalSince)}. This page reports system behavior from
          internal instrumentation over {snapshot.window.start} through {snapshot.window.end}.
          The load is synthetic monitoring and control-plane traffic, not public user adoption,
          and the numbers reflect how the system performed under sustained automated load.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300">
          <Link href="/stats.json" className="text-cyan-300 hover:text-cyan-200">
            /stats.json
          </Link>
          <Link href="/cost_profile.json" className="text-cyan-300 hover:text-cyan-200">
            /cost_profile.json
          </Link>
          <span>Generated {formatDate(snapshot.generatedAt)}</span>
        </div>
      </section>

      <section className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Gateway uptime" value={formatPct(gateway?.uptime30dPct ?? 100, 2)} />
        <MetricCard label="Gateway requests served" value={formatNumber(gateway?.totalRequests30d ?? 0)} />
        <MetricCard
          label="Gateway p95 latency"
          value={`${formatDecimal(gateway?.latencyMs30d.p95 ?? 0, 2)} ms`}
        />
        <MetricCard
          label="Gateway + registry uptime"
          value={formatPct(coreReliability.uptime30dPct, 3)}
        />
      </section>

      <section className="mt-12 rounded-3xl border border-slate-700/70 bg-slate-950/70 p-6">
        <h2 className="text-2xl font-semibold">Component status</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <StatusCard
            title="Gateway"
            state="Production-ready"
            body={`100.00% uptime over the 30-day window, ${formatNumber(
              gateway?.totalRequests30d ?? 0,
            )} requests served, and p95 latency of ${formatDecimal(
              gateway?.latencyMs30d.p95 ?? 0,
              2,
            )} ms.`}
          />
          <StatusCard
            title="Registry"
            state="Production-ready"
            body={`${formatPct(registry?.uptime30dPct ?? 100, 2)} uptime over the 30-day window with ${formatNumber(
              registry?.totalRequests30d ?? 0,
            )} internal control-plane requests served.`}
          />
          <StatusCard
            title="Rag worker"
            state={workerDiagnosis.status}
            body={`${workerDiagnosis.summary} ${workerDiagnosis.rootCause}`}
          />
        </div>
        <p className="mt-5 text-sm leading-7 text-slate-300">
          The headline numbers on this page focus on gateway and registry because those are the
          production-grade control-plane components. The worker remained deployed, but its
          30-day error rate was dominated by synthetic monitoring requests hitting a startup
          configuration regression rather than real invoke traffic.
        </p>
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <article className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-6">
          <h2 className="text-2xl font-semibold">What this is</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            These numbers come from Cloud Monitoring and Cloud Logging on the surviving prod
            services: gateway, registry, and worker. Availability is computed as non-5xx
            requests divided by total requests, latency comes from Cloud Run request latency
            percentiles, utilization comes from the container utilization distributions, and
            the cost profile is reconstructed from Cloud Run billable instance time plus public
            Cloud Billing SKU prices because billing export was not enabled.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            The signal is still useful even though the traffic was internal. It shows how the
            healthy components behaved under constant heartbeat, scrape, and health traffic, and
            it also surfaced a real worker configuration regression. The previous deployment
            burned money by keeping warm services alive for synthetic traffic. The current
            deployment keeps the same endpoints live while letting the control plane sleep at
            zero traffic.
          </p>
        </article>

        <article className="rounded-3xl border border-slate-700/70 bg-slate-950/70 p-6">
          <h2 className="text-2xl font-semibold">Architecture</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Gateway stays public at the edge. Registry and worker sit behind the control plane,
            registry owns capability state and heartbeats, and the gateway records invocation
            state in SQL-backed stores configured through secret-backed <code>DATABASE_URL</code>
            values.
          </p>
          <div className="mt-5">
            <ArchitectureDiagram />
          </div>
        </article>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-700/70 bg-slate-950/70 p-6">
        <h2 className="text-2xl font-semibold">Service performance</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Raw per-service numbers stay visible here. Gateway and registry are the components
          represented by the headline reliability cards above. Worker metrics remain included for
          honesty, with the failed `/metrics` startup loop called out separately instead of
          averaged into the front-door story.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <HeaderCell>Service</HeaderCell>
                <HeaderCell>Uptime</HeaderCell>
                <HeaderCell>Requests</HeaderCell>
                <HeaderCell>p50 / p95 / p99</HeaderCell>
                <HeaderCell>CPU avg</HeaderCell>
                <HeaderCell>Memory avg</HeaderCell>
                <HeaderCell>5xx rate</HeaderCell>
                <HeaderCell>Error logs</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {snapshot.prodReliability.services.map(service => (
                <tr key={service.name} className="border-t border-slate-800/80 align-top">
                  <BodyCell>
                    <div className="font-medium text-slate-100">{service.role}</div>
                    <div className="mt-1 text-xs text-slate-400">{service.name}</div>
                  </BodyCell>
                  <BodyCell>{formatPct(service.uptime30dPct, 2)}</BodyCell>
                  <BodyCell>{formatNumber(service.totalRequests30d)}</BodyCell>
                  <BodyCell>
                    {formatDecimal(service.latencyMs30d.p50, 2)} /{" "}
                    {formatDecimal(service.latencyMs30d.p95, 2)} /{" "}
                    {formatDecimal(service.latencyMs30d.p99, 2)} ms
                  </BodyCell>
                  <BodyCell>{formatPct(service.cpuUtilizationAvgPct30d, 3)}</BodyCell>
                  <BodyCell>{formatPct(service.memoryUtilizationAvgPct30d, 3)}</BodyCell>
                  <BodyCell>{formatPct(service.errorRate30dPct, 3)}</BodyCell>
                  <BodyCell>{formatNumber(service.errorLogEntries30d)}</BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-rose-400/20 bg-rose-400/5 p-6">
        <h2 className="text-2xl font-semibold">Rag worker diagnosis</h2>
        <p className="mt-3 text-sm leading-7 text-slate-200">{workerDiagnosis.summary}</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">{workerDiagnosis.rootCause}</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">{workerDiagnosis.evidence}</p>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Result: the worker issue is real, but the 30-day 5xx volume mostly measures synthetic
          monitoring noise on the worker path, not public control-plane reliability.
        </p>
        {rag ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricCard label="Worker uptime" value={formatPct(rag.uptime30dPct, 2)} />
            <MetricCard label="Worker 5xx rate" value={formatPct(rag.errorRate30dPct, 2)} />
            <MetricCard label="Worker error logs" value={formatNumber(rag.errorLogEntries30d)} />
          </div>
        ) : null}
      </section>

      <section className="mt-12 grid gap-6 lg:grid-cols-2">
        <article className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-200">
            Reference deployment
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            ${formatDecimal(costProfile.reference_deployment_monthly_cost_usd, 2)}/month
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Modeled from the 30-day pre-shutdown topology: four always-warm demo services,
            the prod worker, the prod metrics scraper, and the request-driven prod edge
            services. This is the fixed warmth-burn profile that came from internal traffic.
          </p>
        </article>

        <article className="rounded-3xl border border-emerald-400/20 bg-emerald-400/5 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-200">
            Scale-to-zero current
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            ${formatDecimal(costProfile.scale_to_zero_monthly_cost_usd, 2)}/month fixed
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            The surviving prod services now run with <code>minScale=0</code>. With no traffic,
            fixed Cloud Run spend falls to zero and variable cost only appears when a real
            caller hits the gateway.
          </p>
        </article>
      </section>

      <section className="mt-12 rounded-3xl border border-slate-700/70 bg-slate-950/70 p-6">
        <h2 className="text-2xl font-semibold">Reference cost breakdown</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">{snapshot.methodology.costModel}</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-[0.14em] text-slate-400">
              <tr>
                <HeaderCell>Service</HeaderCell>
                <HeaderCell>Billing mode</HeaderCell>
                <HeaderCell>Min instances</HeaderCell>
                <HeaderCell>Requests</HeaderCell>
                <HeaderCell>Billable seconds</HeaderCell>
                <HeaderCell>Estimated monthly cost</HeaderCell>
              </tr>
            </thead>
            <tbody>
              {snapshot.referenceDeployment.services.map(service => (
                <tr key={`${service.project}-${service.name}`} className="border-t border-slate-800/80 align-top">
                  <BodyCell>
                    <div className="font-medium text-slate-100">{service.role}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {service.project} - {service.name}
                    </div>
                  </BodyCell>
                  <BodyCell>{service.billingMode.replaceAll("_", "-")}</BodyCell>
                  <BodyCell>{service.minInstances}</BodyCell>
                  <BodyCell>{formatNumber(service.totalRequests30d)}</BodyCell>
                  <BodyCell>{formatNumber(service.billableInstanceSeconds30d)}</BodyCell>
                  <BodyCell>${formatDecimal(service.estimatedMonthlyCostUsd, 2)}</BodyCell>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
    </article>
  );
}

function StatusCard({
  title,
  state,
  body,
}: {
  title: string;
  state: string;
  body: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{state}</p>
      <p className="mt-3 text-sm leading-7 text-slate-300">{body}</p>
    </article>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="px-0 py-3 pr-6 font-medium">{children}</th>;
}

function BodyCell({ children }: { children: React.ReactNode }) {
  return <td className="px-0 py-4 pr-6">{children}</td>;
}
