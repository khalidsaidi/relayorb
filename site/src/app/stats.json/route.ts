import { getRelayOrbPublicStats } from "@/lib/publicStats";

export async function GET() {
  const payload = await getRelayOrbPublicStats();
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
