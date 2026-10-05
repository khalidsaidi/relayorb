import { docsMarkdown } from "@/lib/docsMarkdown";

export const dynamic = "force-static";

export function GET() {
  return new Response(docsMarkdown, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
