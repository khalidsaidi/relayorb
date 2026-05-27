const RAW_BASE = "https://raw.githubusercontent.com/khalidsaidi/relayorb/main";

export async function fetchCanonicalMarkdown(pathFromRepoRoot: string) {
  const response = await fetch(`${RAW_BASE}/${pathFromRepoRoot}`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    return null;
  }
  return response.text();
}

export function markdownResponse(markdown: string) {
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
