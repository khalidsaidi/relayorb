import { useEffect, useMemo, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatAssetPrice, formatNumber } from "@/lib/format"
import {
  useFmpChart,
  useFmpQuote,
  useFmpSymbolSearch,
  useFmpProfile,
  useFmpNews,
  useFmpPriceTarget,
  useFmpRating,
} from "@/features/market/use-fmp-data"
import { useSymbolSignals } from "@/features/market/use-symbol-signals"
import { FmpCandleChart, type SignalMarker } from "@/components/charts/FmpCandleChart"
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Newspaper,
  Activity,
  ExternalLink,
  Maximize2,
  X,
} from "lucide-react"
import { useTranslation } from "react-i18next"

type IntervalOption = "1m" | "5m" | "15m" | "30m" | "1h" | "eod"

function normalizeSymbol(symbol: string, assetClass: string) {
  const trimmed = symbol.trim().toUpperCase()
  if (assetClass === "forex") return trimmed.replace(/[/-]/g, "")
  if (assetClass === "crypto") return trimmed.replace(/[/-]/g, "")
  return trimmed.replace(/[/-]/g, "")
}

function StatCard({
  label,
  value,
  subValue,
  icon: Icon,
  color = "text-muted-foreground",
  naLabel = "—",
}: {
  label: string
  value: string | number | undefined
  subValue?: string
  icon?: React.ComponentType<{ className?: string }>
  color?: string
  naLabel?: string
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/30 border border-border/40">
      {Icon && <Icon className={`h-4 w-4 ${color}`} />}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="text-sm font-medium">{value ?? naLabel}</span>
        {subValue && <span className="text-[10px] text-muted-foreground">{subValue}</span>}
      </div>
    </div>
  )
}

export default function LiveChartsPage() {
  const { t } = useTranslation()
  const [symbolInput, setSymbolInput] = useState("AAPL")
  const [assetClass, setAssetClass] = useState<"stock" | "crypto" | "forex">("stock")
  const [activeSymbol, setActiveSymbol] = useState("AAPL")
  const [interval, setInterval] = useState<IntervalOption>("5m")
  const [showIndicators, setShowIndicators] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Handle Escape key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    if (isFullscreen) {
      document.addEventListener("keydown", handleKeyDown)
      document.body.style.overflow = "hidden"
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = ""
    }
  }, [isFullscreen])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

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
  const assetLabel = t(`assets.${assetClass}`)
  const naLabel = t("common.na")
  const searchQuery = symbolInput.trim()
  const { results: symbolMatches } = useFmpSymbolSearch(searchQuery, assetClass)

  // Core data
  const { quote } = useFmpQuote(normalizedSymbol)
  const fmpInterval =
    interval === "1m"
      ? "1min"
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

  // Enhanced data
  const { profile } = useFmpProfile(assetClass === "stock" ? normalizedSymbol : undefined)
  const { news, error: newsError } = useFmpNews(normalizedSymbol, 5)
  const { priceTarget } = useFmpPriceTarget(
    assetClass === "stock" ? normalizedSymbol : undefined
  )
  const { rating } = useFmpRating(assetClass === "stock" ? normalizedSymbol : undefined)
  const { signals: rawSignals } = useSymbolSignals(normalizedSymbol, 20)

  // Convert signals to chart markers
  const signalMarkers: SignalMarker[] = useMemo(() => {
    return rawSignals
      .filter((s) => s.side === "buy" || s.side === "sell")
      .map((s) => ({
        time: s.createdAt.getTime(),
        side: s.side as "buy" | "sell",
        label: s.botId.substring(0, 8),
      }))
  }, [rawSignals])

  const changePct =
    quote?.changePercentage ??
    (quote?.price && quote?.open ? ((quote.price - quote.open) / quote.open) * 100 : undefined)
  const quoteUpdated = quote?.timestamp ? new Date(quote.timestamp).toLocaleTimeString() : null
  const barUpdated = latest?.time ? new Date(latest.time).toLocaleTimeString() : null

  // Parse 52-week range from profile
  const range52w = profile?.range?.split("-").map((s) => parseFloat(s.trim()))
  const low52w = range52w?.[0]
  const high52w = range52w?.[1]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {t("liveCharts.title")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("liveCharts.subtitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("liveCharts.description")}
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
            <option value="stock">{t("assets.stock")}</option>
            <option value="forex">{t("assets.forex")}</option>
            <option value="crypto">{t("assets.crypto")}</option>
          </select>
          <Input
            value={symbolInput}
            onChange={(e) => setSymbolInput(e.target.value)}
            placeholder={t("liveCharts.symbolPlaceholder")}
            className="w-56"
          />
          <Button
            onClick={() => setActiveSymbol(symbolInput || activeSymbol)}
            disabled={!symbolInput.trim()}
          >
            {t("liveCharts.load")}
          </Button>
        </div>
      </div>

      {/* Symbol search results */}
      {symbolMatches.length > 0 && (
        <div className="w-full max-w-xl rounded-lg border border-border/60 bg-background/95 p-2 shadow-sm">
          <div className="text-xs uppercase text-muted-foreground px-1 pb-1">
            {t("liveCharts.matches")}
          </div>
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

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chart card - spans 3 columns */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold">{normalizedSymbol}</span>
                <span className="text-xs uppercase text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                  {assetLabel}
                </span>
                {profile?.companyName && (
                  <span className="text-sm text-muted-foreground hidden sm:inline">
                    {profile.companyName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-2xl font-semibold">
                  {quote?.price !== undefined
                    ? formatAssetPrice(quote.price, assetClass)
                    : naLabel}
                </div>
                <div
                  className={`flex items-center gap-1 font-medium ${
                    changePct !== undefined && changePct >= 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  }`}
                >
                  {changePct !== undefined && changePct >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {changePct !== undefined
                    ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`
                    : ""}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Key stats row */}
            <div className="flex flex-wrap gap-2">
              <StatCard
                label={t("liveCharts.dayHigh")}
                value={quote?.dayHigh ? formatAssetPrice(quote.dayHigh, assetClass) : undefined}
                icon={TrendingUp}
                color="text-emerald-600"
                naLabel={naLabel}
              />
              <StatCard
                label={t("liveCharts.dayLow")}
                value={quote?.dayLow ? formatAssetPrice(quote.dayLow, assetClass) : undefined}
                icon={TrendingDown}
                color="text-rose-600"
                naLabel={naLabel}
              />
              <StatCard
                label={t("liveCharts.prevClose")}
                value={
                  quote?.previousClose
                    ? formatAssetPrice(quote.previousClose, assetClass)
                    : undefined
                }
                naLabel={naLabel}
              />
              <StatCard
                label={t("liveCharts.volume")}
                value={quote?.volume ? formatNumber(quote.volume) : undefined}
                icon={BarChart3}
                naLabel={naLabel}
              />
              {assetClass === "stock" && (
                <>
                  <StatCard
                    label={t("liveCharts.range52w")}
                    value={
                      low52w && high52w
                        ? `$${low52w.toFixed(0)} - $${high52w.toFixed(0)}`
                        : undefined
                    }
                    naLabel={naLabel}
                  />
                  {priceTarget?.targetConsensus && (
                    <StatCard
                      label={t("liveCharts.ptConsensus")}
                      value={`$${priceTarget.targetConsensus.toFixed(2)}`}
                      subValue={
                        priceTarget.targetLow && priceTarget.targetHigh
                          ? `$${priceTarget.targetLow.toFixed(0)}-$${priceTarget.targetHigh.toFixed(0)}`
                          : undefined
                      }
                      icon={Target}
                      color="text-blue-500"
                      naLabel={naLabel}
                    />
                  )}
                  {rating?.ratingRecommendation && (
                    <StatCard
                      label={t("liveCharts.rating")}
                      value={rating.ratingRecommendation}
                      subValue={t("liveCharts.ratingScore", {
                        score: rating.ratingScore ?? naLabel,
                      })}
                      icon={Activity}
                      color={
                        rating.ratingRecommendation?.toLowerCase().includes("buy")
                          ? "text-emerald-600"
                          : rating.ratingRecommendation?.toLowerCase().includes("sell")
                            ? "text-rose-600"
                            : "text-amber-600"
                      }
                    />
                  )}
                </>
              )}
            </div>

            {/* Indicator toggle and fullscreen */}
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showIndicators}
                  onChange={(e) => setShowIndicators(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">{t("liveCharts.showIndicators")}</span>
              </label>
              {signalMarkers.length > 0 && (
                <span className="text-muted-foreground">
                  {t("liveCharts.botSignalsOnChart", { count: signalMarkers.length })}
                </span>
              )}
              <div className="flex-1" />
              <div className="text-muted-foreground">
                {quoteUpdated ? <span>{t("liveCharts.quoteUpdated", { time: quoteUpdated })}</span> : null}
                {barUpdated ? <span className="ml-2">{t("liveCharts.barUpdated", { time: barUpdated })}</span> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="h-7 px-2 gap-1"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("liveCharts.fullscreen")}</span>
              </Button>
            </div>

            {/* Chart tabs */}
            <Tabs value={interval} onValueChange={(v) => setInterval(v as IntervalOption)}>
            <TabsList className="flex flex-wrap justify-start gap-2">
                <TabsTrigger value="1m">{t("liveCharts.oneMinuteShort")}</TabsTrigger>
                <TabsTrigger value="5m">{t("charts.timeframes.m5")}</TabsTrigger>
                <TabsTrigger value="15m">{t("charts.timeframes.m15")}</TabsTrigger>
                <TabsTrigger value="30m">{t("charts.timeframes.m30")}</TabsTrigger>
                <TabsTrigger value="1h">{t("charts.timeframes.h1")}</TabsTrigger>
                <TabsTrigger value="eod">{t("charts.eod")}</TabsTrigger>
              </TabsList>
              {["1m", "5m", "15m", "30m", "1h", "eod"].map((iv) => (
                <TabsContent key={iv} value={iv} className="m-0">
                  <FmpCandleChart
                    bars={bars}
                    signals={signalMarkers}
                    showSma={showIndicators}
                    showEma={showIndicators}
                    showRsi={showIndicators}
                    height={480}
                    data-testid="fmp-chart-live"
                  />
                  {chartError && (
                    <div className="mt-2 text-xs text-rose-600">{chartError}</div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Side panel - news & signals */}
        <div className="space-y-4">
          {/* News card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Newspaper className="h-4 w-4" />
                {t("liveCharts.recentNews")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newsError ? (
                <p className="text-xs text-destructive">
                  {t("liveCharts.newsError", { error: newsError })}
                </p>
              ) : news.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("liveCharts.noRecentNews")}</p>
              ) : (
                <div className="space-y-3">
                  {news.slice(0, 5).map((item, i) => (
                    <a
                      key={i}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block group"
                    >
                      <div className="text-xs font-medium group-hover:text-blue-500 line-clamp-2">
                        {item.title}
                        <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-100" />
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {item.site} &middot;{" "}
                        {item.publishedDate
                          ? new Date(item.publishedDate).toLocaleDateString()
                          : ""}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bot signals card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4" />
                {t("liveCharts.botSignals")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rawSignals.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("liveCharts.noRecentSignals")}
                </p>
              ) : (
                <div className="space-y-2">
                  {rawSignals.slice(0, 8).map((signal) => (
                    <div
                      key={signal.id}
                      className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            signal.side === "buy"
                              ? "bg-emerald-500/20 text-emerald-600"
                              : signal.side === "sell"
                                ? "bg-rose-500/20 text-rose-600"
                                : "bg-slate-500/20 text-slate-600"
                          }`}
                        >
                          {t(`trade.side.${signal.side}`)}
                        </span>
                        <span className="text-muted-foreground">{signal.botId.substring(0, 12)}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {signal.createdAt.toLocaleDateString()}{" "}
                        {signal.createdAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Company info for stocks */}
          {assetClass === "stock" && profile && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("liveCharts.companyInfo")}</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1">
                {profile.sector && (
                  <div>
                    <span className="text-muted-foreground">{t("liveCharts.sector")}:</span> {profile.sector}
                  </div>
                )}
                {profile.industry && (
                  <div>
                    <span className="text-muted-foreground">{t("liveCharts.industry")}:</span> {profile.industry}
                  </div>
                )}
                {profile.mktCap && (
                  <div>
                    <span className="text-muted-foreground">{t("liveCharts.marketCap")}:</span>{" "}
                    ${formatNumber(profile.mktCap)}
                  </div>
                )}
                {profile.beta && (
                  <div>
                    <span className="text-muted-foreground">{t("liveCharts.beta")}:</span> {profile.beta.toFixed(2)}
                  </div>
                )}
                {profile.volAvg && (
                  <div>
                    <span className="text-muted-foreground">{t("liveCharts.avgVolume")}:</span>{" "}
                    {formatNumber(profile.volAvg)}
                  </div>
                )}
                {profile.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center gap-1"
                  >
                    {t("liveCharts.website")} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          {/* Fullscreen header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold">{normalizedSymbol}</span>
              <span className="text-xs uppercase text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                {assetLabel}
              </span>
              {quote?.price !== undefined && (
                <span className="text-lg font-semibold">
                  {formatAssetPrice(quote.price, assetClass)}
                </span>
              )}
              {changePct !== undefined && (
                <span
                  className={`flex items-center gap-1 text-sm font-medium ${
                    changePct >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {changePct >= 0 ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Tabs
                value={interval}
                onValueChange={(v) => setInterval(v as IntervalOption)}
                className="hidden sm:block"
              >
                <TabsList className="h-8">
                  <TabsTrigger value="5m" className="h-7 px-2 text-xs">
                    5m
                  </TabsTrigger>
                  <TabsTrigger value="15m" className="h-7 px-2 text-xs">
                    15m
                  </TabsTrigger>
                  <TabsTrigger value="30m" className="h-7 px-2 text-xs">
                    30m
                  </TabsTrigger>
                  <TabsTrigger value="1h" className="h-7 px-2 text-xs">
                    1h
                  </TabsTrigger>
                  <TabsTrigger value="eod" className="h-7 px-2 text-xs">
                    EOD
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={showIndicators}
                  onChange={(e) => setShowIndicators(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground hidden sm:inline">{t("liveCharts.indicators")}</span>
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 w-8 p-0"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Fullscreen chart */}
          <div className="flex-1 p-2">
            <FmpCandleChart
              bars={bars}
              signals={signalMarkers}
              showSma={showIndicators}
              showEma={showIndicators}
              showRsi={showIndicators}
              height={window.innerHeight - 80}
              data-testid="fmp-chart-fullscreen"
            />
          </div>

          {/* Fullscreen footer with key stats */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border/40 bg-card text-xs overflow-x-auto">
            {quote?.dayHigh && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t("liveCharts.high")}:</span>
                <span className="text-emerald-600 font-medium">
                  {formatAssetPrice(quote.dayHigh, assetClass)}
                </span>
              </div>
            )}
            {quote?.dayLow && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t("liveCharts.low")}:</span>
                <span className="text-rose-600 font-medium">
                  {formatAssetPrice(quote.dayLow, assetClass)}
                </span>
              </div>
            )}
            {quote?.previousClose && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t("liveCharts.prevShort")}:</span>
                <span>{formatAssetPrice(quote.previousClose, assetClass)}</span>
              </div>
            )}
            {quote?.volume && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">{t("liveCharts.volumeShort")}:</span>
                <span>{formatNumber(quote.volume)}</span>
              </div>
            )}
            {signalMarkers.length > 0 && (
              <div className="flex items-center gap-1">
                <Activity className="h-3 w-3 text-blue-500" />
                <span>{t("liveCharts.signalCount", { count: signalMarkers.length })}</span>
              </div>
            )}
            <div className="flex-1" />
            <span className="text-muted-foreground">{t("liveCharts.pressEsc")}</span>
          </div>
        </div>
      )}
    </div>
  )
}
