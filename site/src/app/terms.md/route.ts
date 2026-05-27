import { fetchCanonicalMarkdown, markdownResponse } from "@/lib/markdownMirror";

const fallback = `# RelayOrb terms mirror

Canonical docs source: https://github.com/khalidsaidi/relayorb/blob/main/LICENSE
`;

export async function GET() {
  const markdown = (await fetchCanonicalMarkdown("LICENSE")) || fallback;
  return markdownResponse(markdown);
}
