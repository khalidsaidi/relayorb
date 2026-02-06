import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

type EdgarItem = {
  title?: string
  company?: string
  cik?: string | null
  formType?: string | null
  updated?: string | null
  filedDate?: string | null
  accession?: string | null
  size?: string | null
  link?: string
  summary?: string
}

function formatRelative(time?: string | null) {
  if (!time) return "—"
  const ts = Date.parse(time)
  if (Number.isNaN(ts)) return time
  const diff = Date.now() - ts
  if (diff < 60_000) return "just now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function EdgarTicker() {
  const { t } = useTranslation()
  const baseUrl = useMemo(() => {
    const proxy = (import.meta.env.VITE_MARKET_DATA_PROXY_URL || "").trim()
    const gateway = (import.meta.env.VITE_MARKET_DATA_GATEWAY_URL || "").trim()
    const raw = proxy || gateway
    return raw.replace(/\/+$/, "")
  }, [])

  const [items, setItems] = useState<EdgarItem[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!baseUrl) return
    let alive = true
    
    const load = async () => {
      setStatus((prev) => (prev === "idle" ? "loading" : prev))
      try {
        const res = await fetch(`${baseUrl}/v1/edgar/latest?limit=12`)
        if (!res.ok) throw new Error(`EDGAR fetch failed ${res.status}`)
        const data = await res.json()
        if (!alive) return
        setItems(Array.isArray(data?.items) ? data.items : [])
        setUpdatedAt(data?.updatedAt || null)
        setStatus("idle")
        setError(null)
      } catch (err) {
        if (!alive) return
        setStatus("error")
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    load()
    const intervalId = window.setInterval(load, 30000)
    return () => {
      alive = false
      window.clearInterval(intervalId)
    }
  }, [baseUrl])

  if (!baseUrl) {
    return null
  }

  return (
    <div className="border-b border-border/60 bg-background/60 px-4 py-2 text-xs md:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline">SEC EDGAR</Badge>
        <span className="text-muted-foreground">{t("edgar.latestLabel")}</span>
        <span className="text-muted-foreground">
          {t("edgar.updated")}: {updatedAt ? formatRelative(updatedAt) : t("common.na")}
        </span>
        {status === "error" ? (
          <span className="text-xs text-red-500">{error}</span>
        ) : null}
        <div className="flex flex-1 items-center gap-2 overflow-x-auto">
          {items.map((item, idx) => {
            const label = item.company || item.title || "Unknown"
            return (
              <Button
                key={`${item.accession || idx}`}
                variant="ghost"
                size="sm"
                className="h-7 whitespace-nowrap px-2 text-xs"
                onClick={() => item.link && window.open(item.link, "_blank", "noopener,noreferrer")}
              >
                <span className="mr-2 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase">
                  {item.formType || "SEC"}
                </span>
                {label}
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
