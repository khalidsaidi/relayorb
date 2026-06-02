import { relatedProjects } from "@/lib/crossProject";
import { prodGatewayBaseUrl } from "@/lib/site";

export function relayOrbAgentCard() {
  return {
    name: "RelayOrb",
    description:
      "Tool control plane for AI agents — gateway, registry, worker with contracts, governance, and observability.",
    url: "https://relayorb.com",
    version: "0.1.2",
    documentationUrl: "https://relayorb.com/llms-full.txt",
    apiEndpoints: {
      openapi: "https://relayorb.com/.well-known/openapi.json",
      air: "https://relayorb.com/.well-known/air.json",
      plugin: "https://relayorb.com/.well-known/ai-plugin.json",
      health: `${prodGatewayBaseUrl}/health`,
      invoke: `${prodGatewayBaseUrl}/v1/invoke`,
      submit: `${prodGatewayBaseUrl}/v1/submit`,
      jobs: `${prodGatewayBaseUrl}/v1/jobs/{jobId}`,
      replay: `${prodGatewayBaseUrl}/v1/replay/{requestId}`,
    },
    related: relatedProjects.map(project => ({
      name: project.name,
      url: project.url,
      agent_card_url: project.agentCardUrl,
      description: project.description,
    })),
  };
}
