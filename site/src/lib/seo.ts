import type { Faq } from "@/lib/guides";
import { links } from "@/lib/site";

export const siteUrl = "https://relayorb.com";
export const siteName = "RelayOrb";
export const latestVersion = "0.2.0";

export const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: siteName,
  url: siteUrl,
  description:
    "Open-source CLI that turns real AI agent sessions into tests for MCP servers: it records the messages between an agent and an MCP server, then checks new server builds against the recording or replays it offline.",
  applicationCategory: "DeveloperApplication",
  applicationSubCategory: "MCP debugging and testing",
  operatingSystem: "macOS, Linux, Windows",
  softwareVersion: latestVersion,
  license: "https://www.apache.org/licenses/LICENSE-2.0",
  downloadUrl: links.releases,
  installUrl: `${siteUrl}/install.sh`,
  codeRepository: links.github,
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  keywords:
    "MCP, MCP server, Model Context Protocol, Claude Code MCP, Cursor MCP, Codex MCP, MCP testing, MCP debugging, AI agents",
};

export const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: siteUrl,
};

export function faqPage(faq: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${siteUrl}${item.path}`,
    })),
  };
}
