import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { AnalyticsScripts } from "@/components/AnalyticsScripts";
import { ConsentBanner } from "@/components/ConsentBanner";
import { EngagementAnalytics } from "@/components/EngagementAnalytics";
import { Footer } from "@/components/Footer";
import { OrbBackdrop } from "@/components/OrbBackdrop";
import { RouteAnalytics } from "@/components/RouteAnalytics";
import { TrackedLink } from "@/components/TrackedLink";
import { links } from "@/lib/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://relayorb.com"),
  title: {
    default: "RelayOrb - Tool Control Plane for AI Agents",
    template: "%s | RelayOrb",
  },
  description:
    "Route agent calls to versioned capabilities with contracts, governance, and observability.",
  openGraph: {
    title: "RelayOrb - Tool Control Plane for AI Agents",
    description:
      "Route agent calls to versioned capabilities with contracts, governance, and observability.",
    url: "https://relayorb.com",
    siteName: "RelayOrb",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RelayOrb",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RelayOrb - Tool Control Plane for AI Agents",
    description:
      "Route agent calls to versioned capabilities with contracts, governance, and observability.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        <AnalyticsScripts />
        <Suspense fallback={null}>
          <RouteAnalytics />
          <EngagementAnalytics />
        </Suspense>
        <OrbBackdrop />

        <header className="sticky top-0 z-40 border-b border-slate-800/70 bg-slate-950/65 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-8">
            <TrackedLink
              href="/"
              variant="link"
              className="font-semibold text-slate-100"
              eventName="cta_click"
              eventParams={{ cta: "nav_home", location: "header" }}
            >
              RelayOrb
            </TrackedLink>
            <nav className="hidden items-center gap-4 text-sm text-slate-300 sm:flex">
              <TrackedLink
                href="/demo"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_demo", location: "header" }}
              >
                Demo
              </TrackedLink>
              <TrackedLink
                href="/terraform"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_terraform", location: "header" }}
              >
                Terraform
              </TrackedLink>
              <TrackedLink
                href="/privacy"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_privacy", location: "header" }}
              >
                Privacy
              </TrackedLink>
              <TrackedLink
                href="/stats"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_stats", location: "header" }}
              >
                Stats
              </TrackedLink>
              <TrackedLink
                href={links.github}
                variant="ghost"
                className="px-3 py-1.5"
                eventName="cta_click"
                eventParams={{ cta: "view_github", location: "header" }}
              >
                GitHub
              </TrackedLink>
            </nav>
          </div>
        </header>

        {children}

        <Footer />
        <ConsentBanner />
      </body>
    </html>
  );
}
