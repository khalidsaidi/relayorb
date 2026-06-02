import { getRelayOrbCostProfile } from "@/lib/reliability";

export async function GET() {
  const payload = getRelayOrbCostProfile();
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
