import { useEffect, useRef, useState } from "react"
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  LineSeries,
  HistogramSeries,
  type Time,
} from "lightweight-charts"
import type { FmpBar } from "@/features/market/use-fmp-data"
import { useTranslation } from "react-i18next"

export type SignalMarker = {
  time: number // ms since epoch
  side: "buy" | "sell"
  price?: number
  label?: string
}

export type NewsMarker = {
  time: number // ms since epoch
  title: string
}

type FmpCandleChartProps = {
  bars: FmpBar[]
  height?: number
  signals?: SignalMarker[]
  news?: NewsMarker[]
  showSma?: boolean
  showEma?: boolean
  showRsi?: boolean
  smaPeriod?: number
  emaPeriod?: number
  rsiPeriod?: number
  "data-testid"?: string
}

function calculateSma(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null)
  if (!values.length || period <= 0) return result
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i + 1 - period, i + 1)
    result[i] = slice.reduce((sum, v) => sum + v, 0) / period
  }
  return result
}

function calculateRsi(closes: number[], period = 14) {
  const result: Array<number | null> = Array(closes.length).fill(null)
  if (closes.length < period + 1) return result

  let gains = 0
  let losses = 0

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1]
    if (change > 0) gains += change
    else losses -= change
  }

  let avgGain = gains / period
  let avgLoss = losses / period
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  // Smoothed RSI
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }

  return result
}

function calculateEma(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null)
  if (!values.length || period <= 0) return result
  const multiplier = 2 / (period + 1)
  let ema: number | null = null
  for (let i = 0; i < values.length; i += 1) {
    const value = values[i]
    if (ema === null) {
      if (i + 1 < period) continue
      const slice = values.slice(i + 1 - period, i + 1)
      const avg = slice.reduce((sum, item) => sum + item, 0) / period
      ema = avg
      result[i] = avg
      continue
    }
    ema = value * multiplier + ema * (1 - multiplier)
    result[i] = ema
  }
  return result
}

function calculateEmaFromNullable(values: Array<number | null>, period: number) {
  const filtered: number[] = []
  const indexMap: number[] = []
  values.forEach((value, index) => {
    if (value === null) return
    filtered.push(value)
    indexMap.push(index)
  })
  const emaValues = calculateEma(filtered, period)
  const result: Array<number | null> = Array(values.length).fill(null)
  indexMap.forEach((index, i) => {
    result[index] = emaValues[i]
  })
  return result
}

function calculateMacd(bars: FmpBar[], fast = 12, slow = 26, signal = 9) {
  const closes = bars.map((bar) => bar.close)
  const fastEma = calculateEma(closes, fast)
  const slowEma = calculateEma(closes, slow)
  const macdLine = closes.map((_, index) => {
    const fastValue = fastEma[index]
    const slowValue = slowEma[index]
    if (fastValue === null || slowValue === null) return null
    return fastValue - slowValue
  })
  const signalLine = calculateEmaFromNullable(macdLine, signal)
  const histogram = macdLine.map((value, index) => {
    const signalValue = signalLine[index]
    if (value === null || signalValue === null) return null
    return value - signalValue
  })
  return { macdLine, signalLine, histogram }
}

export function FmpCandleChart({
  bars,
  height = 420,
  signals = [],
  // news markers reserved for future use
  showSma = true,
  showEma = true,
  showRsi = true,
  smaPeriod = 20,
  emaPeriod = 9,
  rsiPeriod = 14,
  "data-testid": testId,
}: FmpCandleChartProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const macdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const emaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const userInteractedRef = useRef(false)
  const [chartError, setChartError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    userInteractedRef.current = false

    let chart: IChartApi | null = null
    let series: ISeriesApi<"Candlestick"> | null = null
    let volumeSeries: ISeriesApi<"Histogram"> | null = null
    let macdSeries: ISeriesApi<"Line"> | null = null
    let macdSignalSeries: ISeriesApi<"Line"> | null = null
    let macdHistSeries: ISeriesApi<"Histogram"> | null = null
    let smaSeries: ISeriesApi<"Line"> | null = null
    let emaSeries: ISeriesApi<"Line"> | null = null
    let rsiSeries: ISeriesApi<"Line"> | null = null
    let resizeObserver: ResizeObserver | null = null

    try {
      chart = createChart(container, {
        width: container.clientWidth,
        height,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: "#cbd5e1",
        },
        grid: {
          vertLines: { color: "rgba(148,163,184,0.2)" },
          horzLines: { color: "rgba(148,163,184,0.2)" },
        },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, rightOffset: 8 },
        crosshair: { mode: CrosshairMode.Normal },
      })

      series = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#ef4444",
        borderUpColor: "#10b981",
        borderDownColor: "#ef4444",
        wickUpColor: "#10b981",
        wickDownColor: "#ef4444",
      })

      // SMA overlay on main chart
      if (showSma) {
        smaSeries = chart.addSeries(LineSeries, {
          color: "#8b5cf6", // purple
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
      }

      // EMA overlay on main chart
      if (showEma) {
        emaSeries = chart.addSeries(LineSeries, {
          color: "#f59e0b", // amber
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
        })
      }

      volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        color: "rgba(148,163,184,0.35)",
        base: 0,
      })

      // RSI panel
      if (showRsi) {
        rsiSeries = chart.addSeries(LineSeries, {
          priceScaleId: "rsi",
          color: "#22d3ee", // cyan
          lineWidth: 2,
          priceLineVisible: false,
        })
      }

      macdSeries = chart.addSeries(LineSeries, {
        priceScaleId: "macd",
        color: "#38bdf8",
        lineWidth: 2,
      })
      macdSignalSeries = chart.addSeries(LineSeries, {
        priceScaleId: "macd",
        color: "#f59e0b",
        lineWidth: 2,
      })
      macdHistSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "macd",
        base: 0,
        color: "rgba(148,163,184,0.35)",
      })

      // Adjust scale margins based on what's shown
      const hasRsi = showRsi
      const priceBottom = hasRsi ? 0.42 : 0.35
      series.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: priceBottom },
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: hasRsi ? 0.78 : 0.85, bottom: 0.02 },
        visible: false,
      })
      if (rsiSeries) {
        rsiSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.62, bottom: 0.26 },
          visible: false,
        })
      }
      macdSeries.priceScale().applyOptions({
        scaleMargins: { top: hasRsi ? 0.78 : 0.7, bottom: hasRsi ? 0.1 : 0.18 },
        visible: false,
      })

      chartRef.current = chart
      seriesRef.current = series
      volumeSeriesRef.current = volumeSeries
      macdSeriesRef.current = macdSeries
      macdSignalSeriesRef.current = macdSignalSeries
      macdHistSeriesRef.current = macdHistSeries
      smaSeriesRef.current = smaSeries
      emaSeriesRef.current = emaSeries
      rsiSeriesRef.current = rsiSeries

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (!containerRef.current || !chartRef.current) return
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height,
          })
        })
        resizeObserver.observe(container)
      } else {
        const handleResize = () => {
          if (!containerRef.current || !chartRef.current) return
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height,
          })
        }
        window.addEventListener("resize", handleResize)
        resizeObserver = {
          observe: () => undefined,
          unobserve: () => undefined,
          disconnect: () => window.removeEventListener("resize", handleResize),
        } as ResizeObserver
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("charts.chartInitFailed")
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChartError(message)
      chart?.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
      rsiSeriesRef.current = null
    }

    return () => {
      resizeObserver?.disconnect()
      chartRef.current?.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistSeriesRef.current = null
      smaSeriesRef.current = null
      emaSeriesRef.current = null
      rsiSeriesRef.current = null
    }
  }, [height, showSma, showEma, showRsi, t])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const markInteracted = () => {
      userInteractedRef.current = true
    }

    container.addEventListener("wheel", markInteracted, { passive: true })
    container.addEventListener("pointerdown", markInteracted)
    container.addEventListener("mousedown", markInteracted)
    container.addEventListener("touchstart", markInteracted, { passive: true })

    return () => {
      container.removeEventListener("wheel", markInteracted)
      container.removeEventListener("pointerdown", markInteracted)
      container.removeEventListener("mousedown", markInteracted)
      container.removeEventListener("touchstart", markInteracted)
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current) return
    const closes = bars.map((bar) => bar.close)

    // Candlestick data
    const candleData: CandlestickData[] = bars.map((bar) => ({
      time: Math.floor(bar.time / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))
    seriesRef.current.setData(candleData)

    // Signal markers on candlestick series
    // Note: setMarkers is available on series but may not be in type definitions
    const seriesWithMarkers = seriesRef.current as typeof seriesRef.current & {
      setMarkers?: (markers: unknown[]) => void
    }
    if (seriesWithMarkers.setMarkers) {
      if (signals.length > 0) {
        const markers = signals
          .filter((s) => s.side === "buy" || s.side === "sell")
          .map((s) => ({
            time: Math.floor(s.time / 1000) as Time,
            position: s.side === "buy" ? ("belowBar" as const) : ("aboveBar" as const),
            color: s.side === "buy" ? "#10b981" : "#ef4444",
            shape: s.side === "buy" ? ("arrowUp" as const) : ("arrowDown" as const),
            text: s.label || s.side.toUpperCase(),
          }))
          .sort((a, b) => (a.time as number) - (b.time as number))
        seriesWithMarkers.setMarkers(markers)
      } else {
        seriesWithMarkers.setMarkers([])
      }
    }

    // Volume
    if (volumeSeriesRef.current) {
      const volumeData: HistogramData[] = bars.map((bar) => ({
        time: Math.floor(bar.time / 1000) as Time,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
      }))
      volumeSeriesRef.current.setData(volumeData)
    }

    // SMA
    if (smaSeriesRef.current) {
      const smaValues = calculateSma(closes, smaPeriod)
      const smaData = smaValues.flatMap((value, index) => {
        if (value === null) return []
        return [{ time: Math.floor(bars[index].time / 1000) as Time, value }]
      })
      smaSeriesRef.current.setData(smaData)
    }

    // EMA
    if (emaSeriesRef.current) {
      const emaValues = calculateEma(closes, emaPeriod)
      const emaData = emaValues.flatMap((value, index) => {
        if (value === null) return []
        return [{ time: Math.floor(bars[index].time / 1000) as Time, value }]
      })
      emaSeriesRef.current.setData(emaData)
    }

    // RSI
    if (rsiSeriesRef.current) {
      const rsiValues = calculateRsi(closes, rsiPeriod)
      const rsiData = rsiValues.flatMap((value, index) => {
        if (value === null) return []
        return [{ time: Math.floor(bars[index].time / 1000) as Time, value }]
      })
      rsiSeriesRef.current.setData(rsiData)
    }

    // MACD
    if (macdSeriesRef.current || macdSignalSeriesRef.current || macdHistSeriesRef.current) {
      const { macdLine, signalLine, histogram } = calculateMacd(bars)
      const macdData = macdLine.flatMap((value, index) => {
        if (value === null) return []
        return [{ time: Math.floor(bars[index].time / 1000) as Time, value }]
      })
      const signalData = signalLine.flatMap((value, index) => {
        if (value === null) return []
        return [{ time: Math.floor(bars[index].time / 1000) as Time, value }]
      })
      const histData = histogram.flatMap((value, index) => {
        if (value === null) return []
        return [
          {
            time: Math.floor(bars[index].time / 1000) as Time,
            value,
            color: value >= 0 ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)",
          },
        ]
      })
      macdSeriesRef.current?.setData(macdData)
      macdSignalSeriesRef.current?.setData(signalData)
      macdHistSeriesRef.current?.setData(histData)
    }

    if (bars.length && chartRef.current && !userInteractedRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [bars, signals, smaPeriod, emaPeriod, rsiPeriod])

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className="relative w-full rounded-lg border border-border/40 bg-muted/20"
      style={{ height }}
    >
      {chartError ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-rose-500">
          {chartError}
        </div>
      ) : null}
      {!chartError && bars.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {t("charts.noChartData")}
        </div>
      ) : null}
    </div>
  )
}
