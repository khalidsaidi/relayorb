import { links } from "@/lib/site";
import { TrackedLink } from "@/components/TrackedLink";

const footerLinks = [
  { label: "GitHub", href: links.github, cta: "footer_github" },
  { label: "Docs", href: "/docs.md", cta: "footer_docs" },
  { label: "Privacy", href: "/privacy", cta: "footer_privacy" },
  { label: "Terms", href: "/terms.md", cta: "footer_terms" },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-800/80 bg-slate-950/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-slate-300 sm:flex-row sm:px-8">
        <span>RelayOrb · Apache-2.0</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {footerLinks.map(link => (
            <TrackedLink
              key={link.label}
              href={link.href}
              variant="link"
              eventName="cta_click"
              eventParams={{ cta: link.cta, location: "footer" }}
            >
              {link.label}
            </TrackedLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}
