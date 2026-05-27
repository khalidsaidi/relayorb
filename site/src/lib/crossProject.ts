export type RelatedProject = {
  key: "a2abench" | "ragmap" | "rootfetch" | "agentability" | "aistatusdashboard";
  name: string;
  url: string;
  description: string;
  statsUrl: string;
  statsJsonUrl: string;
  agentCardUrl: string;
};

export const relatedProjects: RelatedProject[] = [
  {
    key: "a2abench",
    name: "A2ABench",
    url: "https://a2abench-api.web.app",
    description: "Public benchmark for agent Q&A performance.",
    statsUrl: "https://a2abench-api.web.app/stats",
    statsJsonUrl: "https://a2abench-api.web.app/stats.json",
    agentCardUrl: "https://a2abench-api.web.app/.well-known/agent.json",
  },
  {
    key: "ragmap",
    name: "Ragmap",
    url: "https://ragmap-api.web.app",
    description: "MCP search and RAG-focused server discovery.",
    statsUrl: "https://ragmap-api.web.app/stats",
    statsJsonUrl: "https://ragmap-api.web.app/stats.json",
    agentCardUrl: "https://ragmap-api.web.app/.well-known/agent.json",
  },
  {
    key: "rootfetch",
    name: "Rootfetch",
    url: "https://rootfetch.com",
    description: "DNS delegation intelligence with MCP telemetry.",
    statsUrl: "https://rootfetch.com/stats",
    statsJsonUrl: "https://rootfetch.com/stats.json",
    agentCardUrl: "https://rootfetch.com/.well-known/agent.json",
  },
  {
    key: "agentability",
    name: "Agentability",
    url: "https://agentability.org",
    description: "Agent-readiness audit and evidence-backed report publishing.",
    statsUrl: "https://agentability.org/stats",
    statsJsonUrl: "https://agentability.org/stats.json",
    agentCardUrl: "https://agentability.org/.well-known/agent.json",
  },
  {
    key: "aistatusdashboard",
    name: "AIStatusDashboard",
    url: "https://aistatusdashboard.com",
    description: "Real-time AI provider status monitoring with evidence-backed metrics.",
    statsUrl: "https://aistatusdashboard.com/stats",
    statsJsonUrl: "https://aistatusdashboard.com/stats.json",
    agentCardUrl: "https://aistatusdashboard.com/.well-known/agent.json",
  },
];

export function siblingsForManifest() {
  return {
    a2abench: {
      name: "A2ABench",
      url: "https://a2abench-api.web.app",
      stats_url: "https://a2abench-api.web.app/stats",
      stats_json_url: "https://a2abench-api.web.app/stats.json",
      agent_card_url: "https://a2abench-api.web.app/.well-known/agent.json",
    },
    ragmap: {
      name: "Ragmap",
      url: "https://ragmap-api.web.app",
      stats_url: "https://ragmap-api.web.app/stats",
      stats_json_url: "https://ragmap-api.web.app/stats.json",
      agent_card_url: "https://ragmap-api.web.app/.well-known/agent.json",
    },
    rootfetch: {
      name: "Rootfetch",
      url: "https://rootfetch.com",
      stats_url: "https://rootfetch.com/stats",
      stats_json_url: "https://rootfetch.com/stats.json",
      agent_card_url: "https://rootfetch.com/.well-known/agent.json",
    },
    agentability: {
      name: "Agentability",
      url: "https://agentability.org",
      stats_url: "https://agentability.org/stats",
      stats_json_url: "https://agentability.org/stats.json",
      agent_card_url: "https://agentability.org/.well-known/agent.json",
    },
    aistatusdashboard: {
      name: "AIStatusDashboard",
      url: "https://aistatusdashboard.com",
      stats_url: "https://aistatusdashboard.com/stats",
      stats_json_url: "https://aistatusdashboard.com/stats.json",
      agent_card_url: "https://aistatusdashboard.com/.well-known/agent.json",
    },
  };
}
