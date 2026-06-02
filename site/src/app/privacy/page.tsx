import type { Metadata } from "next";
import { TrackedLink } from "@/components/TrackedLink";
import { links } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "RelayOrb privacy policy and data handling practices.",
  openGraph: {
    title: "Privacy | RelayOrb",
    description: "RelayOrb privacy policy and data handling practices.",
  },
  twitter: {
    title: "Privacy | RelayOrb",
    description: "RelayOrb privacy policy and data handling practices.",
  },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-20 sm:px-8">
      <h1 className="text-4xl font-semibold">Privacy</h1>

      <section className="mt-6 space-y-4 text-slate-300" data-analytics-section="privacy_intro">
        <p>
          relayorb.com uses Google Analytics 4 (GA4) for basic product analytics:
          page views and non-identifying interaction events (for example, CTA
          clicks and snippet copy actions).
        </p>
        <p>
          We do not intentionally send personal data to GA4. Events are limited
          to coarse metadata such as UI location and action label.
        </p>
        <p>
          Analytics is consent-controlled. Default consent is denied until you
          click <strong>Accept analytics</strong> in the banner.
        </p>
        <p>
          Rejecting analytics keeps storage denied and does not emit analytics
          events.
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
            <code>page_view</code> on route loads after consent.
          </li>
          <li>
            <code>cta_click</code> for primary navigation and action links.
          </li>
          <li>
            <code>nav_click</code> for non-CTA internal navigation links.
          </li>
          <li>
            <code>copy_code</code> for copy-to-clipboard actions.
          </li>
          <li>
            <code>copy_code_failed</code> when clipboard copy is blocked.
          </li>
          <li>
            <code>outbound_click</code> for external links.
          </li>
          <li>
            <code>consent_choice</code> when analytics consent is accepted.
          </li>
          <li>
            <code>section_view</code> once per section per page visit.
          </li>
          <li>
            <code>scroll_depth</code> at 25/50/75/100% milestones.
          </li>
        </ul>
      </section>

      <p className="mt-8 text-sm text-slate-400">
        This page is for transparency and is not legal advice.
      </p>
    </main>
  );
}
