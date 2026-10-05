import { ImageResponse } from "next/og";
import { getGuide, guides } from "@/lib/guides";

export const alt = "RelayOrb guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return guides.map(guide => ({ slug: guide.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const guide = getGuide((await params).slug);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 80% 20%, #12324a 0%, #070b14 60%)",
          color: "#e2e8f0",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: 6, color: "#67e8f9", textTransform: "uppercase" }}>
          RelayOrb guide
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>
          {guide?.h1 ?? "MCP guides"}
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8" }}>relayorb.com · a flight recorder for AI agents</div>
      </div>
    ),
    size,
  );
}
