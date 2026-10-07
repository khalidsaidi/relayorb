import { markdownResponse } from "@/lib/markdownMirror";

export const dynamic = "force-static";

const body = `# RelayOrb privacy mirror

Canonical source: https://relayorb.com/privacy

- relayorb.com uses Google Analytics 4 in consent mode: before you accept, only cookie-free pings are sent; accepting allows analytics cookies.
- Default consent is denied until accepted in-banner.
- Rejecting keeps analytics cookies denied; cookie-free pings still apply. Google Signals and ad features are off.
- Consent key: \`relayorb_analytics_consent\`.
`;

export async function GET() {
  return markdownResponse(body);
}
