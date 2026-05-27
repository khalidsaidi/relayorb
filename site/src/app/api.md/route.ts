import { fetchCanonicalMarkdown, markdownResponse } from "@/lib/markdownMirror";

const fallback = `# RelayOrb API mirror

Canonical docs source: https://github.com/khalidsaidi/relayorb/blob/main/docs/API.md
`;

export async function GET() {
  const markdown = (await fetchCanonicalMarkdown("docs/API.md")) || fallback;
  return markdownResponse(markdown);
}
