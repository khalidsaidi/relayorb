import { relayOrbAgentCard } from "@/lib/agentCard";

export async function GET() {
  return new Response(JSON.stringify(relayOrbAgentCard()), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
