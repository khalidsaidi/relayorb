import { guides } from "@/lib/guides";

export const sitemapRoutes: { path: string; lastmod: string; priority: number }[] = [
  { path: "/", lastmod: "2026-10-05", priority: 1.0 },
  { path: "/docs", lastmod: "2026-10-05", priority: 0.9 },
  { path: "/guides", lastmod: "2026-10-05", priority: 0.8 },
  ...guides.map(g => ({ path: `/guides/${g.slug}`, lastmod: g.updated, priority: 0.8 })),
  { path: "/privacy", lastmod: "2026-10-05", priority: 0.2 },
];
