import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAssetPrice } from "@/lib/format"
import { useFmpChart, useFmpQuote, useFmpSymbolSearch } from "@/features/market/use-fmp-data"
import { FmpCandleChart } from "@/components/charts/FmpCandleChart"

type IntervalOption = "1m-tv" | "5m" | "15m" | "30m" | "1h" | "eod"

function normalizeSymbol(symbol: string, assetClass: string) {
  const trimmed = symbol.trim().toUpperCase()
  if (assetClass === "forex") return trimmed.replace(/[/-]/g, "")
  if (assetClass === "crypto") return trimmed.replace(/[/-]/g, "")
  return trimmed.replace(/[/-]/g, "")
}

export default function LiveChartsPage() {
  const [symbolInput, setSymbolInput] = useState("AAPL")
  const [assetClass, setAssetClass] = useState<"stock" | "crypto" | "forex">("stock")
  const [activeSymbol, setActiveSymbol] = useState("AAPL")
  const [interval, setInterval] = useState<IntervalOption>("5m")
  const defaultSymbols = useMemo(
    () => ({
      stock: "AAPL",
      forex: "GBPUSD",
      crypto: "BTCUSD",
    }),
    []
  )

  const normalizedSymbol = useMemo(
    () => normalizeSymbol(activeSymbol, assetClass),
    [activeSymbol, assetClass]
  )
  const searchQuery = symbolInput.trim()
  const { results: symbolMatches } = useFmpSymbolSearch(searchQuery, assetClass)

  const { quote } = useFmpQuote(normalizedSymbol)
  const fmpInterval =
    interval === "1m-tv"
      ? "5min"
      : interval === "eod"
        ? "eod"
        : interval === "1h"
          ? "1hour"
          : interval === "30m"
            ? "30min"
            : interval === "15m"
              ? "15min"
              : "5min"
  const { bars, latest, error: chartError } = useFmpChart(
    normalizedSymbol,
    fmpInterval,
    120,
    assetClass
  )

  const tvUrl = useMemo(() => {
    if (!normalizedSymbol) return ""
    const params = new URLSearchParams({
      symbol: normalizedSymbol,
      interval: "1",
      theme: "dark",
      style: "1",
      locale: "en",
      autosize: "true",
    })
    return `https://www.tradingview.com/widgetembed/?${params.toString()}`
  }, [normalizedSymbol])

  const changePct =
    quote?.changePercentage ??
    (quote?.price && quote?.open ? ((quote.price - quote.open) / quote.open) * 100 : undefined)
  const quoteUpdated = quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString() : null
  const barUpdated = latest?.time ? new Date(latest.time).toLocaleTimeString() : null
  const barLabel =
    interval === "1m-tv" ? "5m bar" : interval === "eod" ? "EOD bar" : `${interval} bar`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Charts</div>
          <h1 className="text-3xl font-bold tracking-tight">Live Charts</h1>
          <p className="text-sm text-muted-foreground">
            Explore symbols with real-time quotes and intraday history from FMP.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-border/60 bg-background px-3 py-2 text-sm"
            value={assetClass}
            onChange={(e) => {
              const nextClass = e.target.value as "stock" | "crypto" | "forex"
              setAssetClass(nextClass)
              const nextSymbol = defaultSymbols[nextClass]
              setSymbolInput(nextSymbol)
              setActiveSymbol(nextSymbol)
            }}
          >
            <option value="stock">Stock</option>
            <option value="forex">Forex</option>
            <option value="crypto">Crypto</option>
          </select>
          <Input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder="Symbol (e.g., AAPL, EURUSD, BTCUSD)"
            className="w-56"
          />
          <Button
            onClick={() => setActiveSymbol(symbolInput || activeSymbol)}
            disabled={!symbolInput.trim()}
          >
            Load
          </Button>
        </div>
      </div>
      {symbolMatches.length > 0 && (
        <div className="w-full max-w-xl rounded-lg border border-border/60 bg-background/95 p-2 shadow-sm">
          <div className="text-xs uppercase text-muted-foreground px-1 pb-1">Matches</div>
          <div className="flex flex-col divide-y divide-border/60">
            {symbolMatches.map((match) => (
              <button
                key={`${match.symbol}-${match.exchange || ""}`}
                className="flex items-center justify-between px-2 py-1 text-left hover:bg-muted/60"
                onClick={() => {
                  setSymbolInput(match.symbol)
                  setActiveSymbol(match.symbol)
                }}
              >
                <span className="font-semibold">{match.symbol}</span>
                <span className="text-xs text-muted-foreground">
                  {match.name || match.exchange || match.currency || ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {normalizedSymbol}
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {assetClass}
              </span>
            </span>
            <div className="flex items-center gap-3 text-sm">
              <div className="text-2xl font-semibold">
                {quote?.price !== undefined
                  ? formatAssetPrice(quote.price, assetClass)
                  : "—"}
              </div>
              <div
                className={
                  changePct !== undefined && changePct >= 0
                    ? "text-emerald-600 font-medium"
                    : "text-rose-600 font-medium"
                }
              >
                {changePct !== undefined ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : ""}
              </div>
              <div className="flex flex-col text-xs text-muted-foreground">
                {quoteUpdated ? <span>Quote {quoteUpdated}</span> : null}
                {barUpdated ? <span>Last {barLabel} {barUpdated}</span> : null}
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={interval} onValueChange={(v) => setInterval(v as IntervalOption)}>
            <TabsList className="flex flex-wrap justify-start gap-2">
              <TabsTrigger value="1m-tv">1m (TradingView)</TabsTrigger>
              <TabsTrigger value="5m">5m</TabsTrigger>
              <TabsTrigger value="15m">15m</TabsTrigger>
              <TabsTrigger value="30m">30m</TabsTrigger>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="eod">EOD</TabsTrigger>
            </TabsList>
            <TabsContent value="1m-tv" className="m-0">
              {tvUrl ? (
                <iframe
                  src={tvUrl}
                  className="h-[440px] w-full border-0 rounded-lg"
                  title={`TradingView chart for ${normalizedSymbol}`}
                  allow="clipboard-write"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[360px] items-center justify-center text-muted-foreground">
                  No chart data
                </div>
              )}
            </TabsContent>
            <TabsContent value="5m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-live" />
              {chartError ? (
                <div className="mt-2 text-xs text-rose-600">{chartError}</div>
              ) : null}
            </TabsContent>
            <TabsContent value="15m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-live" />
              {chartError ? (
                <div className="mt-2 text-xs text-rose-600">{chartError}</div>
              ) : null}
            </TabsContent>
            <TabsContent value="30m" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-live" />
              {chartError ? (
                <div className="mt-2 text-xs text-rose-600">{chartError}</div>
              ) : null}
            </TabsContent>
            <TabsContent value="1h" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-live" />
              {chartError ? (
                <div className="mt-2 text-xs text-rose-600">{chartError}</div>
              ) : null}
            </TabsContent>
            <TabsContent value="eod" className="m-0">
              <FmpCandleChart bars={bars} data-testid="fmp-chart-live" />
              {chartError ? (
                <div className="mt-2 text-xs text-rose-600">{chartError}</div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
