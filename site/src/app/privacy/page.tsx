import { TrackedLink } from "@/components/TrackedLink";
import { links } from "@/lib/site";

export const metadata = {
  title: "RelayOrb Privacy",
  description: "Analytics and consent disclosure for relayorb.com.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-20 sm:px-8">
      <h1 className="text-4xl font-semibold">Privacy</h1>

      <section className="mt-6 space-y-4 text-slate-300">
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
          You can revoke by clearing site data/local storage for this domain.
          Consent is stored locally using key
          <code className="ml-1">relayorb_analytics_consent</code>.
        </p>
        <p>
          Product security posture documentation is available in
          <TrackedLink href={links.securityDoc} variant="link" className="ml-1">
            SECURITY.md
          </TrackedLink>
          .
        </p>
      </section>

      <p className="mt-8 text-sm text-slate-400">
        This page is for transparency and is not legal advice.
      </p>
    </main>
  );
}
