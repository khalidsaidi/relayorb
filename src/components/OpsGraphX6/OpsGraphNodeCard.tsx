import type { Node } from "@antv/x6"

type NodeMetricData = {
  label: string
  category?: string
  status?: "active" | "idle" | "error"
  lastSeenMs?: number | null
  ratePerMin?: number | null
  rateLabel?: string
  p95Ms?: number | null
  errorRate?: number | null
  zoom?: number
  tvMode?: boolean
}

const STATUS_COLORS: Record<NonNullable<NodeMetricData["status"]>, { bg: string; text: string }> = {
  active: { bg: "#dcfce7", text: "#166534" },
  idle: { bg: "#e2e8f0", text: "#475569" },
  error: { bg: "#fee2e2", text: "#b91c1c" },
}

function formatAge(ms: number | null | undefined) {
  if (!ms || ms <= 0) return "—"
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

function formatRate(rate: number | null | undefined) {
  if (rate === null || rate === undefined) return "—"
  if (rate < 0.1) return rate.toFixed(2)
  if (rate < 10) return rate.toFixed(1)
  return Math.round(rate).toString()
}

function formatP95(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return `${Math.round(value)}ms`
}

function formatErrorRate(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return `${Math.round(value)}%`
}

export function OpsGraphNodeCard({ node }: { node: Node }) {
  const data = node.getData() as NodeMetricData
  const status = data.status || "idle"
  const zoom = data.zoom ?? 1
  const tvMode = data.tvMode ?? false
  // In TV mode, always show full details
  const detailLevel = tvMode ? "full" : zoom < 0.7 ? "compact" : zoom < 1 ? "mid" : "full"
  const statusTone = STATUS_COLORS[status]

  // ============================================
  // TV MODE: Optimized for 65" TV viewing from 10+ feet
  // ============================================
  // - Large, bold sans-serif fonts (Arial/Helvetica)
  // - High contrast (pure black text)
  // - Increased letter-spacing
  // - Solid white background
  // - Thick borders for definition
  // ============================================

  // ==============================================
  // TV MODE: Maximum readability - large centered text
  // Light background, simplified content
  // ==============================================

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    borderRadius: tvMode ? 8 : 14,
    border: tvMode 
      ? `4px solid ${status === "active" ? "#16a34a" : status === "error" ? "#dc2626" : "#6b7280"}`
      : "1px solid rgba(148,163,184,0.5)",
    background: "#ffffff",
    boxShadow: tvMode ? "none" : "0 10px 26px rgba(15,23,42,0.08)",
    padding: tvMode ? "4px 8px" : "10px 12px",
    fontFamily: tvMode 
      ? "Impact, Arial Black, sans-serif" 
      : "var(--font-sans, ui-sans-serif)",
    color: "#000000",
    display: "flex",
    flexDirection: "column",
    alignItems: tvMode ? "center" : "stretch",
    justifyContent: "center",
    gap: 4,
    boxSizing: "border-box",
    overflow: "hidden",
  }

  // TV: Single large centered title
  const titleStyle: React.CSSProperties = {
    fontSize: tvMode ? 24 : detailLevel === "compact" ? 11 : 12,
    fontWeight: tvMode ? 900 : 600,
    letterSpacing: tvMode ? 2 : 0.2,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    color: "#000000",
    textAlign: tvMode ? "center" : undefined,
    textTransform: tvMode ? "uppercase" : undefined,
  }

  const metaStyle: React.CSSProperties = {
    fontSize: detailLevel === "compact" ? 9 : 10,
    color: "#64748b",
    display: tvMode ? "none" : "flex",  // Hide metrics in TV mode
    gap: 8,
    flexWrap: "nowrap",
    lineHeight: 1.2,
    overflow: "hidden",
  }

  const pillStyle: React.CSSProperties = {
    display: tvMode ? "none" : "block",  // Hide pill in TV mode - border shows status
    flexShrink: 0,
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    background: statusTone.bg,
    color: statusTone.text,
  }

  // TV Mode: Render text as SVG for sharper rendering
  if (tvMode) {
    const label = (data.label || node.id).toUpperCase()
    const borderColor = status === "active" ? "#16a34a" : status === "error" ? "#dc2626" : "#6b7280"
    
    return (
      <div style={{
        width: "100%",
        height: "100%",
        borderRadius: 8,
        border: `4px solid ${borderColor}`,
        background: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        overflow: "hidden",
        padding: "4px",
      }}>
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 200 60"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        >
          <text
            x="100"
            y="38"
            textAnchor="middle"
            fontFamily="Impact, Arial Black, Helvetica, sans-serif"
            fontSize="22"
            fontWeight="900"
            fill="#000000"
            letterSpacing="2"
          >
            {label.length > 18 ? label.slice(0, 16) + "…" : label}
          </text>
        </svg>
      </div>
    )
  }

  // Normal mode: Regular HTML rendering
  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={titleStyle}>{data.label || node.id}</div>
        <span style={pillStyle}>{status}</span>
      </div>
      {detailLevel !== "compact" ? (
        <div style={metaStyle}>
          <span>Last {formatAge(data.lastSeenMs)}</span>
          <span>
            {(data.rateLabel || "events") + "/min"} {formatRate(data.ratePerMin)}
          </span>
        </div>
      ) : null}
      {detailLevel === "full" ? (
        <div style={metaStyle}>
          <span>P95 {formatP95(data.p95Ms)}</span>
          <span>Err {formatErrorRate(data.errorRate)}</span>
        </div>
      ) : null}
    </div>
  )
}
