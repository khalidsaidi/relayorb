const body = `User-agent: *
Allow: /

Sitemap: https://relayorb.com/sitemap.xml
`;

export async function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
