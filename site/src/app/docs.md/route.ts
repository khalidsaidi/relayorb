import { fetchCanonicalMarkdown, markdownResponse } from "@/lib/markdownMirror";

const fallback = `# RelayOrb docs mirror

Canonical docs source: https://github.com/khalidsaidi/relayorb/blob/main/README.md
`;

export async function GET() {
  const markdown = (await fetchCanonicalMarkdown("README.md")) || fallback;
  return markdownResponse(markdown);
}
