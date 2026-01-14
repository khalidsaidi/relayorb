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
  const penalties = components.penalties || {}
  const rows: ComponentRow[] = [
    { key: "momentum", label: "Momentum", value: components.momentum ?? 0 },
    { key: "consensus", label: "Bot consensus", value: components.consensus ?? 0 },
    { key: "liquidity", label: "Liquidity", value: components.liquidity ?? 0 },
    { key: "news", label: "News sentiment", value: components.news ?? 0 },
    { key: "universe", label: "Universe boost", value: components.universe ?? 0 },
    { key: "penalty-spread", label: "Spread penalty", value: penalties.spread ?? 0 },
    { key: "penalty-liquidity", label: "Liquidity penalty", value: penalties.liquidity ?? 0 },
    { key: "penalty-price", label: "Price penalty", value: penalties.price ?? 0 },
    { key: "penalty-volume", label: "Volume penalty", value: penalties.volume ?? 0 },
    { key: "penalty-sentiment", label: "Sentiment penalty", value: penalties.sentiment ?? 0 },
  ]
  return rows.filter((row) => typeof row.value === "number" && row.value !== 0)
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
    if (trendComponents) {
      const hasNewShape =
        "consensus" in trendComponents ||
        "liquidity" in trendComponents ||
        "penalties" in trendComponents
      return hasNewShape
        ? buildHotTradeComponents(trendComponents as MarketTradeScoreComponents)
        : buildTrendComponents(trendComponents as {
            momentum?: number
            volume?: number
            signals?: number
            news?: number
          })
    }
    return []
  }, [scoreComponents, trendComponents])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
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
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {profile ? <Badge variant="outline" className="text-[10px]">Profile: {profile}</Badge> : null}
              {asset.source ? <Badge variant="outline" className="text-[10px]">Source: {asset.source}</Badge> : null}
              {asset.signals?.total ? (
                <Badge variant="outline" className="text-[10px]">
                  Bots: {asset.signals.buy ?? 0} buy / {asset.signals.sell ?? 0} sell
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                Components
              </div>
              {componentRows.length > 0 ? (
                <div className="grid gap-1">
                  {componentRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs"
                    >
                      <span>{row.label}</span>
                      <span className="font-mono text-[11px]">{formatValue(row.value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No component breakdown available.
                </div>
              )}
            </div>

            {analysis?.summary || analysis?.details?.length ? (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  Explanation
                </div>
                {analysis.summary ? (
                  <div className="text-xs text-muted-foreground">{analysis.summary}</div>
                ) : null}
                {analysis.details?.length ? (
                  <ul className="space-y-0.5 text-xs text-muted-foreground list-disc pl-4 max-h-48 overflow-y-auto">
                    {analysis.details.map((detail, index) => (
                      <li key={`${asset.symbol}-detail-${index}`}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
