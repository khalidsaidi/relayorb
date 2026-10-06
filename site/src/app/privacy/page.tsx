import type { Metadata } from "next";
import { TrackedLink } from "@/components/TrackedLink";
import { links } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "RelayOrb privacy policy and data handling practices.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy | RelayOrb",
    description: "RelayOrb privacy policy and data handling practices.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RelayOrb",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy | RelayOrb",
    description: "RelayOrb privacy policy and data handling practices.",
    images: ["/og-image.png"],
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-20 sm:px-8">
      <h1 className="text-4xl font-semibold">Privacy</h1>

      <section className="mt-6 space-y-4 text-slate-300" data-analytics-section="privacy_intro">
        <p>
          relayorb.com uses Google Analytics 4 (GA4) to understand how the site is
          used: page views, non-identifying interaction events (for example link
          clicks, code copies, and scroll depth), and page performance (Core Web
          Vitals).
        </p>
        <p>
          We do not intentionally send personal data to GA4. Events carry coarse
          metadata such as the page type, the link or button label, and where on
          the page it was. Google Signals and ad features are off.
        </p>
        <p>
          GA4 runs in Google&apos;s consent mode. Until you click{" "}
          <strong>Accept analytics</strong>, analytics cookies are denied: GA4
          receives only cookie-free pings that do not identify your browser
          across visits. Accepting allows analytics cookies, so repeat visits can
          be counted.
        </p>
        <p>
          Rejecting keeps analytics cookies denied for good; the cookie-free pings
          described above still apply.
        </p>
        <p>
          You can revoke by clearing site data/local storage for this domain.
          Consent is stored locally using key
          <code className="ml-1">relayorb_analytics_consent</code>.
        </p>
        <p>
          Product security posture documentation is available in
          <TrackedLink
            href={links.securityDoc}
            variant="link"
            className="ml-1"
            eventName="cta_click"
            eventParams={{ cta: "open_security_doc", location: "privacy_page" }}
          >
            SECURITY.md
          </TrackedLink>
          .
        </p>
      </section>

      <section
        className="mt-8 rounded-2xl border border-slate-700/70 bg-slate-950/70 p-6 text-slate-300"
        data-analytics-section="privacy_events"
      >
        <h2 className="text-xl font-medium text-slate-100">Analytics events in use</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>
            <code>page_view</code> on every page load and in-site navigation.
          </li>
          <li>
            <code>cta_click / nav_click</code> for action links and other internal links.
          </li>
          <li>
            <code>outbound_click / github_click</code> for links to other sites (github_click for GitHub).
          </li>
          <li>
            <code>code_copy / install_copy</code> when code is copied (install_copy for install commands).
          </li>
          <li>
            <code>code_copy_failed</code> when clipboard copy is blocked.
          </li>
          <li>
            <code>section_view</code> once per section per page visit.
          </li>
          <li>
            <code>scroll_depth</code> at 25/50/75/100% milestones.
          </li>
          <li>
            <code>read_complete</code> after scrolling 75% of a page and staying 30 seconds.
          </li>
          <li>
            <code>page_exit</code> when you leave a page, with seconds on page and deepest scroll.
          </li>
          <li>
            <code>web_vital</code> page performance measurements (LCP, INP, CLS, FCP, TTFB).
          </li>
          <li>
            <code>page_not_found</code> when a page does not exist.
          </li>
          <li>
            <code>consent_choice</code> when you accept or reject analytics.
          </li>
        </ul>
      </section>

      <p className="mt-8 text-sm text-slate-400">
        This page is for transparency and is not legal advice.
      </p>
    </main>
  );
}
