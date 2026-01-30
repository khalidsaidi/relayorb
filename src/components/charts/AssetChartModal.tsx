import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MarketHotTrade } from "@/lib/types"
import { formatAssetPrice } from "@/lib/format"
import { useMarketChart, useMarketQuote } from "@/features/market/use-market-data"
import { MarketCandleChart } from "@/components/charts/MarketCandleChart"
import { useTranslation } from "react-i18next"

type AssetChartModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: MarketHotTrade | null
}

export function AssetChartModal({ open, onOpenChange, asset }: AssetChartModalProps) {
  const { t } = useTranslation()
  const [interval, setInterval] = useState<"1m" | "5m" | "15m" | "30m" | "1h" | "eod">("5m")
  const marketInterval =
    interval === "1m"
      ? "1min"
      : interval === "eod"
        ? "eod"
        : interval === "1h"
          ? "1hour"
          : interval === "5m"
            ? "5min"
            : interval === "15m"
              ? "15min"
              : "30min"

  const { quote } = useMarketQuote(asset?.symbol)
  const { bars, latest, error: chartError } = useMarketChart(
    asset?.symbol,
    marketInterval,
    120,
    asset?.assetClass
  )

  if (!asset) return null

  const displaySymbol = asset.symbol
  const assetLabel = t(`market.asset.${asset.assetClass}`)
  const sideLabel = asset.side ? t(`trade.side.${asset.side}`) : t("common.na")
  const changePct =
    quote?.changePercentage ??
    (quote?.price && quote?.open ? ((quote.price - quote.open) / quote.open) * 100 : undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] max-h-[90vh] flex flex-col p-4 gap-4" showCloseButton={true}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {t("charts.chartTitle", { symbol: displaySymbol, assetClass: assetLabel })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("charts.tradingViewDescription", { symbol: displaySymbol })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase text-muted-foreground">{t("charts.last")}</span>
              <span className="text-2xl font-semibold">
                {quote?.price !== undefined
                  ? formatAssetPrice(quote.price, asset.assetClass)
                  : formatAssetPrice(asset.price ?? NaN, asset.assetClass)}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xs uppercase text-muted-foreground">{t("charts.twentyFourHour")}</span>
              <span
                className={
                  changePct !== undefined && changePct >= 0
                    ? "text-emerald-600 font-medium"
                    : "text-rose-600 font-medium"
                }
              >
                {changePct !== undefined
                  ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
                  : asset.momentum?.change24h !== undefined
                    ? `${asset.momentum.change24h >= 0 ? "+" : ""}${asset.momentum.change24h.toFixed(2)}%`
                    : "—"}
              </span>
            </div>
            {quote?.volume !== undefined ? (
              <div className="flex items-baseline gap-2 text-muted-foreground">
                <span className="text-xs uppercase">{t("charts.volume")}</span>
                <span className="font-medium">{quote.volume.toLocaleString()}</span>
              </div>
            ) : null}
            {latest ? (
              <div className="text-xs text-muted-foreground">
                {t("charts.updatedAt", { time: new Date(latest.time).toLocaleTimeString() })}
              </div>
            ) : null}
          </div>

          <Tabs value={interval} onValueChange={(v) => setInterval(v as typeof interval)} className="flex flex-col gap-3">
            <TabsList className="w-full justify-start gap-2 overflow-x-auto">
              <TabsTrigger value="1m">{t("charts.oneMinute")}</TabsTrigger>
              <TabsTrigger value="5m">{t("charts.timeframes.m5")}</TabsTrigger>
              <TabsTrigger value="15m">{t("charts.timeframes.m15")}</TabsTrigger>
              <TabsTrigger value="30m">{t("charts.timeframes.m30")}</TabsTrigger>
              <TabsTrigger value="1h">{t("charts.timeframes.h1")}</TabsTrigger>
              <TabsTrigger value="eod">{t("charts.eod")}</TabsTrigger>
            </TabsList>

            <TabsContent value="1m" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="5m" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="15m" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="30m" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="1h" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="eod" className="m-0">
              <MarketCandleChart bars={bars} data-testid="market-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
          </Tabs>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-shrink-0 bg-muted/30 rounded-lg p-4">
          <div>
            <div className="text-muted-foreground mb-1">{t("charts.currentPrice")}</div>
            <div className="font-semibold text-lg">
              {Number.isFinite(asset.price)
                ? formatAssetPrice(asset.price, asset.assetClass)
                : t("common.na")}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">{t("charts.twentyFourHourChange")}</div>
            <div
              className={`font-semibold text-lg ${asset.momentum?.change24h && asset.momentum.change24h >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {asset.momentum?.change24h
                ? `${asset.momentum.change24h >= 0 ? "+" : ""}${asset.momentum.change24h.toFixed(2)}%`
                : t("common.na")}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">{t("charts.score")}</div>
            <div className="font-semibold text-lg">{asset.score?.toFixed(1) ?? t("common.na")}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">{t("charts.side")}</div>
            <div
              className={`font-semibold text-lg uppercase ${asset.side?.toUpperCase() === "BUY" ? "text-green-600" : asset.side?.toUpperCase() === "SELL" ? "text-red-600" : ""}`}
            >
              {sideLabel}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
