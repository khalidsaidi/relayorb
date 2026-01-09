import { useMemo } from "react"
import type { MarketHotTrade, MarketTrendItem, MarketTradeScoreComponents } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ScoreBreakdownAsset = MarketHotTrade | MarketTrendItem

type ScoreBreakdownDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: ScoreBreakdownAsset | null
}

type ComponentRow = {
  key: string
  label: string
  value: number
}

function formatValue(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—"
  return value.toFixed(1)
}

function buildHotTradeComponents(components: MarketTradeScoreComponents): ComponentRow[] {
  const rows: ComponentRow[] = [
    { key: "momentum", label: "Momentum", value: components.momentum ?? 0 },
    { key: "consensus", label: "Bot consensus", value: components.consensus ?? 0 },
    { key: "liquidity", label: "Liquidity", value: components.liquidity ?? 0 },
    { key: "news", label: "News sentiment", value: components.news ?? 0 },
    { key: "shortMomentum", label: "Short momentum (1m/5m)", value: components.shortMomentum ?? 0 },
    { key: "strength", label: "Signal strength", value: components.strength ?? 0 },
    { key: "recency", label: "Signal recency", value: components.recency ?? 0 },
    { key: "watchlist", label: "Watchlist boost", value: components.watchlist ?? 0 },
    { key: "primary", label: "Primary boost", value: components.primary ?? 0 },
    { key: "base", label: "Base", value: components.base ?? 0 },
  ]
  return rows.filter((row) => Number.isFinite(row.value))
}

function buildTrendComponents(components: {
  momentum?: number
  volume?: number
  signals?: number
  news?: number
}): ComponentRow[] {
  const rows: ComponentRow[] = [
    { key: "momentum", label: "Momentum", value: components.momentum ?? 0 },
    { key: "volume", label: "Volume", value: components.volume ?? 0 },
    { key: "signals", label: "Bot signals", value: components.signals ?? 0 },
    { key: "news", label: "News", value: components.news ?? 0 },
  ]
  return rows.filter((row) => Number.isFinite(row.value))
}

export function ScoreBreakdownDialog({ open, onOpenChange, asset }: ScoreBreakdownDialogProps) {
  const score = asset?.score
  const assetClass = asset?.assetClass?.toUpperCase() ?? ""
  const profile = asset && "profile" in asset ? asset.profile : undefined
  const scoreComponents = asset && "scoreComponents" in asset ? asset.scoreComponents : undefined
  const trendComponents = asset && "components" in asset ? asset.components : undefined
  const analysis = asset && "analysis" in asset ? asset.analysis : undefined

  const componentRows = useMemo(() => {
    if (scoreComponents) return buildHotTradeComponents(scoreComponents)
    if (trendComponents) return buildTrendComponents(trendComponents)
    return []
  }, [scoreComponents, trendComponents])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {asset?.symbol ? `${asset.symbol} Score Breakdown` : "Score Breakdown"}
          </DialogTitle>
          <DialogDescription>
            {asset
              ? [
                  assetClass,
                  typeof score === "number" ? `Score ${score.toFixed(1)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Select an asset to see how the score is built."}
          </DialogDescription>
        </DialogHeader>

        {asset ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {profile ? <Badge variant="outline">Profile: {profile}</Badge> : null}
              {asset.source ? <Badge variant="outline">Source: {asset.source}</Badge> : null}
              {asset.signals?.total ? (
                <Badge variant="outline">
                  Bots: {asset.signals.buy ?? 0} buy / {asset.signals.sell ?? 0} sell
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Components
              </div>
              {componentRows.length > 0 ? (
                <div className="grid gap-2">
                  {componentRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span>{row.label}</span>
                      <span className="font-mono">{formatValue(row.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No component breakdown available for this asset yet.
                </div>
              )}
            </div>

            {analysis?.summary || analysis?.details?.length ? (
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Explanation
                </div>
                {analysis.summary ? (
                  <div className="text-sm text-muted-foreground">{analysis.summary}</div>
                ) : null}
                {analysis.details?.length ? (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {analysis.details.map((detail, index) => (
                      <li key={`${asset.symbol}-detail-${index}`}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No written breakdown available yet.
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
