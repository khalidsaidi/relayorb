import { useMemo } from "react"
import type { MarketHotTrade, MarketTrendItem, MarketTradeScoreComponents } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAnalysisNoteKind, localizeAnalysis } from "@/lib/analysis-localize"
import { useTranslation } from "react-i18next"

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

function formatValue(value: number | undefined, naLabel: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) return naLabel
  return value.toFixed(1)
}

function buildHotTradeComponents(
  components: MarketTradeScoreComponents,
  labels: Record<string, string>
): ComponentRow[] {
  const penalties = components.penalties || {}
  const rows: ComponentRow[] = [
    { key: "momentum", label: labels.momentum, value: components.momentum ?? 0 },
    { key: "consensus", label: labels.consensus, value: components.consensus ?? 0 },
    { key: "liquidity", label: labels.liquidity, value: components.liquidity ?? 0 },
    { key: "news", label: labels.newsSentiment, value: components.news ?? 0 },
    { key: "universe", label: labels.universeBoost, value: components.universe ?? 0 },
    { key: "penalty-spread", label: labels.spreadPenalty, value: penalties.spread ?? 0 },
    { key: "penalty-liquidity", label: labels.liquidityPenalty, value: penalties.liquidity ?? 0 },
    { key: "penalty-price", label: labels.pricePenalty, value: penalties.price ?? 0 },
    { key: "penalty-volume", label: labels.volumePenalty, value: penalties.volume ?? 0 },
    { key: "penalty-sentiment", label: labels.sentimentPenalty, value: penalties.sentiment ?? 0 },
  ]
  return rows.filter((row) => typeof row.value === "number" && row.value !== 0)
}

function buildTrendComponents(components: {
  momentum?: number
  volume?: number
  signals?: number
  news?: number
}, labels: Record<string, string>): ComponentRow[] {
  const rows: ComponentRow[] = [
    { key: "momentum", label: labels.momentum, value: components.momentum ?? 0 },
    { key: "volume", label: labels.volume, value: components.volume ?? 0 },
    { key: "signals", label: labels.botSignals, value: components.signals ?? 0 },
    { key: "news", label: labels.news, value: components.news ?? 0 },
  ]
  return rows.filter((row) => Number.isFinite(row.value))
}

export function ScoreBreakdownDialog({ open, onOpenChange, asset }: ScoreBreakdownDialogProps) {
  const { t, i18n } = useTranslation()
  const score = asset?.score
  const assetLabelMap: Record<string, string> = {
    stock: t("assets.stock"),
    crypto: t("assets.crypto"),
    forex: t("assets.fx"),
  }
  const assetClass = asset?.assetClass
    ? assetLabelMap[asset.assetClass] ?? asset.assetClass
    : ""
  const profile = asset && "profile" in asset ? asset.profile : undefined
  const profileLabel = profile
    ? t(`analysis.profileLabels.${profile}`, { defaultValue: profile })
    : ""
  const scoreComponents = asset && "scoreComponents" in asset ? asset.scoreComponents : undefined
  const trendComponents = asset && "components" in asset ? asset.components : undefined
  const analysis = asset && "analysis" in asset ? asset.analysis : undefined
  const localizedAnalysis = localizeAnalysis(analysis, t, i18n.language)
  const rawDetails = analysis?.details ?? []
  const labels = useMemo(
    () => ({
      momentum: t("score.components.momentum"),
      consensus: t("score.components.consensus"),
      liquidity: t("score.components.liquidity"),
      newsSentiment: t("score.components.newsSentiment"),
      universeBoost: t("score.components.universeBoost"),
      spreadPenalty: t("score.components.spreadPenalty"),
      liquidityPenalty: t("score.components.liquidityPenalty"),
      pricePenalty: t("score.components.pricePenalty"),
      volumePenalty: t("score.components.volumePenalty"),
      sentimentPenalty: t("score.components.sentimentPenalty"),
      volume: t("score.components.volume"),
      botSignals: t("score.components.botSignals"),
      news: t("score.components.news"),
    }),
    [t]
  )

  const componentRows = useMemo(() => {
    if (scoreComponents) return buildHotTradeComponents(scoreComponents, labels)
    if (trendComponents) {
      const hasNewShape =
        "consensus" in trendComponents ||
        "liquidity" in trendComponents ||
        "penalties" in trendComponents
      return hasNewShape
        ? buildHotTradeComponents(trendComponents as MarketTradeScoreComponents, labels)
        : buildTrendComponents(trendComponents as {
            momentum?: number
            volume?: number
            signals?: number
            news?: number
          }, labels)
    }
    return []
  }, [labels, scoreComponents, trendComponents])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {asset?.symbol
              ? t("score.titleWithSymbol", { symbol: asset.symbol })
              : t("score.title")}
          </DialogTitle>
          <DialogDescription>
            {asset
              ? [
                  assetClass,
                  typeof score === "number" ? t("score.scoreValue", { score: score.toFixed(1) }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : t("score.emptyState")}
          </DialogDescription>
        </DialogHeader>

        {asset ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
              {profile ? (
                <Badge variant="outline" className="text-[10px]">
                  {t("score.profile", { profile: profileLabel })}
                </Badge>
              ) : null}
              {asset.source ? (
                <Badge variant="outline" className="text-[10px]">
                  {t("score.source", { source: asset.source })}
                </Badge>
              ) : null}
              {asset.signals?.total ? (
                <Badge variant="outline" className="text-[10px]">
                  {t("score.botSignals", {
                    buy: asset.signals.buy ?? 0,
                    sell: asset.signals.sell ?? 0,
                  })}
                </Badge>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                {t("score.componentsTitle")}
              </div>
              {componentRows.length > 0 ? (
                <div className="grid gap-1">
                  {componentRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between rounded border border-border/50 bg-muted/20 px-2.5 py-1.5 text-xs"
                    >
                      <span>{row.label}</span>
                      <span className="font-mono text-[11px]">{formatValue(row.value, t("common.na"))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {t("score.noComponents")}
                </div>
              )}
            </div>

            {localizedAnalysis.summary || localizedAnalysis.details?.length ? (
              <div className="space-y-1.5">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                  {t("score.explanation")}
                </div>
                {localizedAnalysis.summary ? (
                  <div className="text-xs text-muted-foreground">{localizedAnalysis.summary}</div>
                ) : null}
                {localizedAnalysis.details?.length ? (
                  <ul className="space-y-0.5 text-xs text-muted-foreground list-disc pl-4 max-h-48 overflow-y-auto">
                    {localizedAnalysis.details.map((detail, index) => {
                      const noteKind = getAnalysisNoteKind(rawDetails[index])
                      return (
                        <li key={`${asset.symbol}-detail-${index}`}>
                          <span className="inline-flex items-center gap-1">
                            {noteKind ? (
                              <Badge
                                variant="outline"
                                className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
                              >
                                {t(`analysis.badges.${noteKind}`)}
                              </Badge>
                            ) : null}
                            <span>{detail}</span>
                          </span>
                        </li>
                      )
                    })}
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
