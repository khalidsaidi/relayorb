import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CodeBlock } from "@/components/CodeBlock";
import { JsonLd } from "@/components/JsonLd";
import { TrackedLink } from "@/components/TrackedLink";
import { getGuide, guides } from "@/lib/guides";
import { breadcrumbs, faqPage, siteName, siteUrl } from "@/lib/seo";
import { installCommand, links } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map(guide => ({ slug: guide.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = getGuide((await params).slug);
  if (!guide) return {};
  const url = `/guides/${guide.slug}`;
  return {
    title: { absolute: guide.title },
    description: guide.description,
    keywords: guide.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: guide.title,
      description: guide.description,
      siteName,
      modifiedTime: guide.updated,
    },
    twitter: { card: "summary_large_image", title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: Props) {
  const guide = getGuide((await params).slug);
  if (!guide) notFound();
  const related = guides.filter(g => g.slug !== guide.slug).slice(0, 4);

  return (
    <div className="relative min-h-screen text-slate-100">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: guide.h1,
          description: guide.description,
          url: `${siteUrl}/guides/${guide.slug}`,
          dateModified: guide.updated,
          keywords: guide.keywords.join(", "),
          publisher: { "@type": "Organization", name: siteName, url: siteUrl },
          about: { "@type": "SoftwareApplication", name: siteName, url: siteUrl },
        }}
      />
      <JsonLd data={faqPage(guide.faq)} />
      <JsonLd
        data={breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.h1, path: `/guides/${guide.slug}` },
        ])}
      />

      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-8 sm:pt-16">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-400">
          <ol className="flex flex-wrap gap-1">
            <li><Link href="/" className="hover:text-slate-200">Home</Link> /</li>
            <li><Link href="/guides" className="hover:text-slate-200">Guides</Link> /</li>
          </ol>
        </nav>

        <article>
          <h1 className="mt-4 text-3xl leading-tight font-semibold sm:text-5xl">{guide.h1}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Updated <time dateTime={guide.updated}>{guide.updated}</time>
          </p>
          <p className="mt-6 text-lg text-slate-300">{guide.intro}</p>

          {guide.sections.map(section => (
            <section key={section.heading} className="mt-10">
              <h2 className="text-2xl font-semibold">{section.heading}</h2>
              {section.body.map(paragraph => (
                <p key={paragraph} className="mt-3 text-slate-300">{paragraph}</p>
              ))}
              {section.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-6 text-slate-300">
                  {section.list.map(item => (
                    <li key={item} className="break-words">{item}</li>
                  ))}
                </ul>
              )}
              {section.code && (
                <div className="mt-4 min-w-0">
                  <CodeBlock
                    title={section.code.title}
                    code={section.code.code}
                    snippetId={`guide_${guide.slug}`}
                  />
                </div>
              )}
            </section>
          ))}

          <section className="mt-12 rounded-2xl border border-cyan-300/40 bg-cyan-400/5 p-5 sm:p-6">
            <h2 className="text-xl font-semibold">Install RelayOrb</h2>
            <p className="mt-2 text-slate-300">
              Free and open source (Apache-2.0). A single binary for macOS, Linux, and Windows.
              No account, no cloud, no telemetry.
            </p>
            <div className="mt-4 min-w-0">
              <CodeBlock title="macOS / Linux" code={installCommand} snippetId={`install_${guide.slug}`} />
            </div>
            <p className="mt-3 text-sm text-slate-400">
              Windows and other options:{" "}
              <TrackedLink
                href={links.releases}
                variant="link"
                eventName="outbound_click"
                eventParams={{ destination: "github_releases", location: `guide_${guide.slug}` }}
              >
                GitHub Releases
              </TrackedLink>
              .
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-semibold">FAQ</h2>
            <dl className="mt-4 space-y-5">
              {guide.faq.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-medium text-slate-100">{q}</dt>
                  <dd className="mt-1 text-slate-300">{a}</dd>
                </div>
              ))}
            </dl>
          </section>
        </article>

        <aside className="mt-14 border-t border-slate-800 pt-8">
          <h2 className="text-lg font-semibold">More guides</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {related.map(g => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="text-cyan-200 hover:text-cyan-100">{g.h1}</Link>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
  );
}
