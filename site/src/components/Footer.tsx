import { links } from "@/lib/site";
import { TrackedLink } from "@/components/TrackedLink";
import { relatedProjects } from "@/lib/crossProject";

type AgentabilityLatest = {
  score?: number;
};

async function loadRelayorbAuditScore() {
  try {
    const response = await fetch(
      "https://agentability.org/v1/evaluations/relayorb.com/latest.json",
      {
        cache: "no-store",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as AgentabilityLatest;
    if (typeof payload.score !== "number" || Number.isNaN(payload.score)) {
      return null;
    }
    return Math.round(payload.score);
  } catch {
    return null;
  }
}

export async function Footer() {
  const auditScore = await loadRelayorbAuditScore();
  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/60">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-3 px-6 py-6 text-sm text-slate-300">
        <span>RelayOrb</span>
        <span className="opacity-50">|</span>
        <TrackedLink
          href={links.github}
          variant="link"
          eventName="outbound_click"
          eventParams={{ destination: "github.com/khalidsaidi/relayorb", location: "footer" }}
        >
          GitHub
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href={links.prodModule}
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_prod_module", location: "footer" }}
        >
          Terraform prod
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href={links.demoModule}
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_demo_module", location: "footer" }}
        >
          Terraform demo
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href="/privacy"
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_privacy", location: "footer" }}
        >
          Privacy
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href="/stats"
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_stats", location: "footer" }}
        >
          Stats
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href="/reliability"
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_reliability", location: "footer" }}
        >
          Reliability
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href="/stats.json"
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_stats_json", location: "footer" }}
        >
          Stats JSON
        </TrackedLink>
        <span className="opacity-50">|</span>
        <TrackedLink
          href="/.well-known/agent.json"
          variant="link"
          eventName="cta_click"
          eventParams={{ cta: "footer_agent_card", location: "footer" }}
        >
          Agent card
        </TrackedLink>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 px-6 pb-4 text-xs text-slate-300">
        <span className="font-medium">Cross-project:</span>
        {relatedProjects.map((project, index) => (
          <span key={project.key}>
            <a href={project.statsUrl} className="text-cyan-300 hover:text-cyan-200">
              {project.name}
            </a>
            {index < relatedProjects.length - 1 ? <span> · </span> : <span> </span>}
          </span>
        ))}
        <span>— benchmark · MCP search · DNS delegation · agent-readiness audit · status monitoring</span>
      </div>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-6 pb-8 text-xs text-slate-300">
        <a
          href="https://agentability.org/reports/relayorb.com"
          className="text-cyan-300 hover:text-cyan-200"
        >
          Audited by Agentability — score {auditScore ?? "N/A"}/100 (full report)
        </a>
      </div>
    </footer>
  );
}
