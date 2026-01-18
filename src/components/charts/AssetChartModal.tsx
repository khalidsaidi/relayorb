import { useMemo, useState } from "react"
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
import { useFmpChart, useFmpQuote } from "@/features/market/use-fmp-data"
import { FmpCandleChart } from "@/components/charts/FmpCandleChart"
import { useTranslation } from "react-i18next"

type AssetChartModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: MarketHotTrade | null
}

/**
 * Normalizes symbol for TradingView widget
 * TradingView supports:
 * - Stocks: Exchange:SYMBOL (NASDAQ:AAPL, NYSE:MSFT) or just SYMBOL
 * - Crypto: Exchange:SYMBOL (COINBASE:BTCUSD, KRAKEN:ETHUSD)
 * - Forex: OANDA:EURUSD, FX:EURUSD, or FX_IDC:EURUSD
 */
function normalizeSymbolForTradingView(
  symbol: string,
  assetClass: string,
  exchange?: string | null
): string {
  const trimmed = symbol.trim().toUpperCase()

  if (assetClass === 'stock') {
    // Stocks: Try exchange prefix, fallback to symbol only
    // TradingView will auto-detect exchange if symbol is well-known
    const cleanSymbol = trimmed.replace(/\//g, '').replace(/-/g, '')

    // For well-known stocks, just use the symbol (TradingView auto-detects)
    // For less common ones, you might want to add exchange prefix
    return cleanSymbol
  } else if (assetClass === 'crypto') {
    // Crypto: Use exchange prefix (default COINBASE).
    const exchangeHint = (exchange || '').toUpperCase()
    const exchangePrefix = exchangeHint.includes('COINBASE')
      ? 'COINBASE'
      : exchangeHint.includes('KRAKEN')
        ? 'KRAKEN'
        : exchangeHint.includes('BITSTAMP')
          ? 'BITSTAMP'
          : 'COINBASE'

    // If already has exchange prefix, keep it.
    if (trimmed.includes(':')) {
      return trimmed
    }

    let base = trimmed
    let quote = ''

    if (trimmed.includes('/') || trimmed.includes('-')) {
      const parts = trimmed.replace('-', '/').split('/').filter(Boolean)
      if (parts.length === 2) {
        base = parts[0]
        quote = parts[1]
      }
    } else {
      const quotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'EUR']
      for (const q of quotes) {
        if (trimmed.endsWith(q) && trimmed.length > q.length) {
          base = trimmed.slice(0, -q.length)
          quote = q
          break
        }
      }
    }

    if (!quote) {
      return `${exchangePrefix}:${base}`
    }
    if (quote === 'USDT') {
      quote = 'USD'
    }
    return `${exchangePrefix}:${base}${quote}`
  } else if (assetClass === 'forex') {
    // Forex: Use OANDA: prefix or FX: prefix
    const cleanSymbol = trimmed.replace('/', '').replace('-', '')
    // If already has prefix, keep it
    if (cleanSymbol.includes(':')) {
      return cleanSymbol
    }
    // Default to OANDA for forex
    return `OANDA:${cleanSymbol}`
  }

  return trimmed.replace(/\//g, '').replace(/-/g, '')
}

export function AssetChartModal({ open, onOpenChange, asset }: AssetChartModalProps) {
  const { t } = useTranslation()
  const [interval, setInterval] = useState<"1m-tv" | "5m" | "15m" | "30m" | "1h" | "eod">("5m")
  const tvInterval = interval === "1m-tv"
  const fmpInterval =
    interval === "eod"
      ? "eod"
      : interval === "1h"
        ? "1hour"
        : interval === "5m"
          ? "5min"
          : interval === "15m"
            ? "15min"
            : "30min"

  const { quote } = useFmpQuote(asset?.symbol)
  const { bars, latest, error: chartError } = useFmpChart(
    asset?.symbol,
    tvInterval ? "5min" : fmpInterval,
    120,
    asset?.assetClass
  )

  // Generate TradingView widget URL
  const chartUrl = useMemo(() => {
    if (!asset?.symbol) return ""

    const symbol = normalizeSymbolForTradingView(
      asset.symbol,
      asset.assetClass,
      asset.exchange
    )

    // TradingView Advanced Chart widget
    const params = new URLSearchParams({
      symbol,
      interval: "1",
      theme: "dark",
      style: "1", // Candlestick
      locale: "en",
      toolbar_bg: "rgba(0,0,0,0)",
      enable_publishing: "false",
      hide_top_toolbar: "false",
      hide_legend: "false",
      save_image: "false",
      container_id: "tradingview_chart",
      autosize: "true",
      studies: "", // No studies by default
      width: "100%",
      height: "100%",
    })

    return `https://www.tradingview.com/widgetembed/?${params.toString()}`
  }, [asset])

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
              <TabsTrigger value="1m-tv">{t("charts.oneMinuteTv")}</TabsTrigger>
              <TabsTrigger value="5m">{t("charts.timeframes.m5")}</TabsTrigger>
              <TabsTrigger value="15m">{t("charts.timeframes.m15")}</TabsTrigger>
              <TabsTrigger value="30m">{t("charts.timeframes.m30")}</TabsTrigger>
              <TabsTrigger value="1h">{t("charts.timeframes.h1")}</TabsTrigger>
              <TabsTrigger value="eod">{t("charts.eod")}</TabsTrigger>
            </TabsList>

            <TabsContent value="1m-tv" className="m-0">
              <div className="relative w-full flex-1 min-h-[320px] border rounded-lg bg-background overflow-hidden">
                {chartUrl ? (
                  <iframe
                    src={chartUrl}
                    className="w-full h-[420px] border-0"
                    title={t("charts.tradingViewTitle", { symbol: displaySymbol })}
                    allow="clipboard-write"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-muted-foreground">
                    {t("charts.noChartData")}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="5m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="15m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="30m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="1h" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-modal" />
              {chartError && <div className="text-xs text-rose-600 mt-2">{chartError}</div>}
            </TabsContent>
            <TabsContent value="eod" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-modal" />
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
