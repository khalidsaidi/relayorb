function renderSitemap() {
  const now = new Date().toISOString();
  const urls = [
    "https://relayorb.com/",
    "https://relayorb.com/about",
    "https://relayorb.com/demo",
    "https://relayorb.com/terraform",
    "https://relayorb.com/privacy",
    "https://relayorb.com/reliability",
    "https://relayorb.com/stats",
    "https://relayorb.com/stats.json",
    "https://relayorb.com/cost_profile.json",
    "https://relayorb.com/.well-known/agent.json",
    "https://relayorb.com/.well-known/air.json",
    "https://relayorb.com/.well-known/openapi.json",
    "https://relayorb.com/.well-known/openapi.yaml",
    "https://relayorb.com/.well-known/ai-plugin.json",
    "https://relayorb.com/llms.txt",
    "https://relayorb.com/llms-full.txt",
    "https://relayorb.com/docs.md",
    "https://relayorb.com/api.md",
    "https://relayorb.com/spec.md",
    "https://relayorb.com/status.md",
    "https://relayorb.com/terms.md",
    "https://relayorb.com/privacy.md",
    "https://relayorb.com/cookies.md",
  ];

  const items = urls
    .map(url => {
      return `  <url><loc>${url}</loc><lastmod>${now}</lastmod></url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export async function GET() {
  return new Response(renderSitemap(), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
