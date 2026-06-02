import Link from "next/link";
import { getRelayOrbPublicStats } from "@/lib/publicStats";

export const dynamic = "force-dynamic";

export default async function RelayOrbStatsPage() {
  const stats = await getRelayOrbPublicStats();
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16 text-slate-100 sm:px-8">
      <h1 className="text-3xl font-semibold sm:text-4xl">RelayOrb public stats</h1>
      <p className="mt-3 max-w-3xl text-slate-300">
        Public counters stay honest about external traffic. Reliability fields link to the
        separate 30-day internal-monitoring report.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Invokes total" value={stats.invokes_total} />
        <StatCard label="Invokes 7d / 30d" value={`${stats.invokes_7d} / ${stats.invokes_30d}`} />
        <StatCard
          label="Unique callers 7d / 30d"
          value={`${stats.unique_callers_7d} / ${stats.unique_callers_30d}`}
        />
        <StatCard
          label="Latency median / p95 (ms)"
          value={`${stats.median_invoke_latency_ms} / ${stats.p95_invoke_latency_ms}`}
        />
        <StatCard label="Tool-call success %" value={stats.tool_call_success_pct} />
        <StatCard label="Policy denials 7d" value={stats.policy_denials_7d} />
        <StatCard label="Idempotency replays" value={stats.idempotency_replays_total} />
        <StatCard label="Jobs queued (current)" value={stats.jobs_queued_current} />
        <StatCard label="Capabilities registered" value={stats.capabilities_registered} />
        <StatCard label="Workers healthy" value={stats.workers_healthy} />
        <StatCard label="Operational since" value={stats.operational_since} />
        <StatCard label="30d uptime %" value={stats.uptime_30d_pct} />
        <StatCard
          label="Internal requests 30d"
          value={stats.total_internal_requests_30d}
        />
        <StatCard label="Gateway p95 latency 30d" value={stats.p95_latency_ms_30d} />
        <StatCard
          label="Terraform downloads (prod/demo)"
          value={`${stats.terraform_downloads.prod_module}/${stats.terraform_downloads.demo_module}`}
        />
        <StatCard label="Last invoke timestamp" value={stats.last_invoke_ts} />
      </div>
      <p className="mt-6 text-sm text-slate-400">
        Generated {stats.generated_at} · JSON:{" "}
        <a href="/stats.json" className="text-cyan-300 hover:text-cyan-200">
          /stats.json
        </a>
        {" · "}
        <a href={stats.reliability_report_url} className="text-cyan-300 hover:text-cyan-200">
          /reliability
        </a>
      </p>
      <p className="mt-3 text-sm">
        <Link href="/" className="text-cyan-300 hover:text-cyan-200">
          Back to homepage
        </Link>
      </p>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-slate-700/70 bg-slate-950/70 p-4">
      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-100">{value}</p>
    </article>
  );
}
