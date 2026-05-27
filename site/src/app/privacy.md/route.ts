import { markdownResponse } from "@/lib/markdownMirror";

const body = `# RelayOrb privacy mirror

Canonical source: https://relayorb.com/privacy

- relayorb.com uses Google Analytics 4 only after consent.
- Default consent is denied until accepted in-banner.
- Rejecting analytics keeps storage denied and suppresses analytics events.
- Consent key: \`relayorb_analytics_consent\`.
`;

export async function GET() {
  return markdownResponse(body);
}
