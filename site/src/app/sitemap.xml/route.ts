const urls = [
  "https://relayorb.com/",
  "https://relayorb.com/privacy",
  "https://relayorb.com/docs.md",
  "https://relayorb.com/llms.txt",
  "https://relayorb.com/llms-full.txt",
  "https://relayorb.com/privacy.md",
  "https://relayorb.com/terms.md",
  "https://relayorb.com/cookies.md",
];

function renderSitemap() {
  const items = urls.map(url => `  <url><loc>${url}</loc></url>`).join("\n");
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
