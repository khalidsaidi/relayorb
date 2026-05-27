import { fetchCanonicalMarkdown, markdownResponse } from "@/lib/markdownMirror";

const fallback = `# RelayOrb spec mirror

Canonical docs source: https://github.com/khalidsaidi/relayorb/blob/main/docs/ARCH.md
`;

export async function GET() {
  const markdown = (await fetchCanonicalMarkdown("docs/ARCH.md")) || fallback;
  return markdownResponse(markdown);
}
