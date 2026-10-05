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

const defaultTitle = "RelayOrb: record, replay & test MCP servers";
const defaultDescription =
  "Free, open-source flight recorder for AI agents: see every MCP tool call Claude Code, Cursor, or Codex makes, replay it offline, and test MCP servers in CI.";

export const metadata: Metadata = {
  metadataBase: new URL("https://relayorb.com"),
  title: {
    default: defaultTitle,
    template: "%s | RelayOrb",
  },
  description: defaultDescription,
  applicationName: "RelayOrb",
  keywords: [
    "MCP server",
    "MCP",
    "Model Context Protocol",
    "Claude Code MCP",
    "Cursor MCP",
    "Codex MCP",
    "MCP testing",
    "MCP debugging",
    "AI agents",
  ],
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: "https://relayorb.com",
    siteName: "RelayOrb",
    locale: "en_US",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "RelayOrb: a flight recorder for AI agents" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
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
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
            <TrackedLink
              href="/"
              variant="link"
              className="font-semibold text-slate-100"
              eventName="cta_click"
              eventParams={{ cta: "nav_home", location: "header" }}
            >
              RelayOrb
            </TrackedLink>
            <nav className="flex items-center gap-3 text-sm text-slate-300 sm:gap-4">
              <TrackedLink
                href="/#commands"
                variant="link"
                className="hidden sm:inline"
                eventName="cta_click"
                eventParams={{ cta: "nav_commands", location: "header" }}
              >
                Commands
              </TrackedLink>
              <TrackedLink
                href="/guides"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_guides", location: "header" }}
              >
                Guides
              </TrackedLink>
              <TrackedLink
                href="/docs"
                variant="link"
                eventName="cta_click"
                eventParams={{ cta: "nav_docs", location: "header" }}
              >
                Docs
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
