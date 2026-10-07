import { siteUrl } from "@/lib/seo";
import { sitemapRoutes } from "@/lib/sitemapRoutes";

export const dynamic = "force-static";

function renderSitemap() {
  const items = sitemapRoutes
    .map(
      r =>
        `  <url><loc>${siteUrl}${r.path}</loc><lastmod>${r.lastmod}</lastmod><priority>${r.priority.toFixed(1)}</priority></url>`,
    )
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
