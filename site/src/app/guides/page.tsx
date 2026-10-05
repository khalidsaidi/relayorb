import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { guides } from "@/lib/guides";
import { breadcrumbs } from "@/lib/seo";

const title = "MCP guides: Claude Code, Cursor, Codex, testing & debugging";
const description =
  "Practical MCP server guides: what MCP is, setting up MCP in Claude Code, Cursor, Codex, and Claude Desktop, and how to debug and test MCP servers.";

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/guides" },
  openGraph: { url: "/guides", title, description, type: "website", images: ["/og-image.png"] },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
};

export default function GuidesIndex() {
  return (
    <div className="relative min-h-screen text-slate-100">
      <JsonLd data={breadcrumbs([{ name: "Home", path: "/" }, { name: "Guides", path: "/guides" }])} />
      <main className="mx-auto w-full max-w-4xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
        <h1 className="text-3xl font-semibold sm:text-5xl">MCP guides</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">{description}</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {guides.map(guide => (
            <li key={guide.slug}>
              <Link
                href={`/guides/${guide.slug}`}
                className="block h-full rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5 transition hover:border-cyan-300/60"
              >
                <h2 className="text-lg font-medium text-slate-100">{guide.h1}</h2>
                <p className="mt-2 text-sm text-slate-400">{guide.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
