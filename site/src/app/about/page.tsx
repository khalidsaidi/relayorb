import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { TrackedLink } from "@/components/TrackedLink";
import {
  homepagePersonaDescription,
  whoItIsntFor,
  whoItsFor,
} from "@/lib/positioning";
import { links } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: homepagePersonaDescription,
  openGraph: {
    title: "About | RelayOrb",
    description: homepagePersonaDescription,
    url: "https://relayorb.com/about",
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
    title: "About | RelayOrb",
    description: homepagePersonaDescription,
    images: ["/og-image.png"],
  },
};

const howItWorks = [
  "Gateway validates caller auth, policy, and JSON schema before a tool call leaves the control plane.",
  "Registry keeps track of healthy providers so routing decisions are versioned and observable instead of hard-coded.",
  "Workers return validated responses, while RelayOrb records the invocation state you need for debugging, rollback, and audit.",
];

export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 pb-16 sm:px-8">
      <section className="pt-24 pb-10">
        <Reveal>
          <p className="mb-4 text-xs uppercase tracking-[0.22em] text-cyan-300">
            About RelayOrb
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-semibold sm:text-5xl">
            A control plane for teams already operating production AI agents
          </h1>
          <p className="mt-6 max-w-3xl text-lg text-slate-300 sm:text-xl">
            {homepagePersonaDescription}
          </p>
        </Reveal>
      </section>

      <section className="py-8">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">What this does</h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            RelayOrb sits between your agents and your tools. It gives you one
            place to validate schemas, route by capability version, enforce
            auth and policy, and inspect what actually happened when a call
            fails in production.
          </p>
        </Reveal>
      </section>

      <section className="py-8">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">Who this is for</h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            RelayOrb is for teams that already feel the pain of many agents
            calling many tools in production.
          </p>
        </Reveal>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {whoItsFor.map(persona => (
            <Reveal key={persona.title}>
              <article className="h-full rounded-2xl border border-slate-700/70 bg-slate-950/70 p-5">
                <h3 className="text-lg font-medium">{persona.title}</h3>
                {persona.body.map(paragraph => (
                  <p key={paragraph} className="mt-3 text-sm text-slate-300">
                    {paragraph}
                  </p>
                ))}
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6">
            <h3 className="text-xl font-semibold text-slate-100">Who this isn&apos;t for</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {whoItIsntFor.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="py-8">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">How it works</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {howItWorks.map(step => (
              <div
                key={step}
                className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-4 text-sm text-slate-200"
              >
                {step}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      <section className="py-8">
        <Reveal>
          <h2 className="text-2xl font-semibold sm:text-3xl">Project status</h2>
          <p className="mt-3 max-w-3xl text-slate-300">
            RelayOrb is open source, deployed in production, and packaged for
            self-hosting through Terraform modules. The public site exposes
            operational evidence through the{" "}
            <TrackedLink
              href="/reliability"
              variant="link"
              eventName="cta_click"
              eventParams={{ cta: "about_reliability", location: "about_status" }}
            >
              reliability report
            </TrackedLink>{" "}
            and{" "}
            <TrackedLink
              href="/stats"
              variant="link"
              eventName="cta_click"
              eventParams={{ cta: "about_stats", location: "about_status" }}
            >
              public stats
            </TrackedLink>
            .
          </p>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            If you are already running production agents and need a control
            plane instead of more glue code, start with the{" "}
            <TrackedLink
              href={links.prodModule}
              variant="link"
              eventName="cta_click"
              eventParams={{ cta: "about_prod_module", location: "about_status" }}
            >
              Terraform module
            </TrackedLink>
            .
          </p>
        </Reveal>
      </section>
    </main>
  );
}
