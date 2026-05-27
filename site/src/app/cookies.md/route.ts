import { markdownResponse } from "@/lib/markdownMirror";

const body = `# RelayOrb cookies mirror

Canonical source: https://relayorb.com/privacy

- Analytics storage defaults to denied.
- No analytics cookies are written until explicit acceptance.
- Users can revoke by clearing local storage/site data for relayorb.com.
`;

export async function GET() {
  return markdownResponse(body);
}
