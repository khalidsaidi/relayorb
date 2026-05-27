import { fetchCanonicalMarkdown, markdownResponse } from "@/lib/markdownMirror";

const fallback = `# RelayOrb status mirror

Canonical docs source: https://github.com/khalidsaidi/relayorb/blob/main/docs/RUNBOOK.md
`;

export async function GET() {
  const markdown = (await fetchCanonicalMarkdown("docs/RUNBOOK.md")) || fallback;
  return markdownResponse(markdown);
}
