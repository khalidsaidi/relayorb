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

type FmpCandleChartProps = {
  bars: FmpBar[]
  height?: number
  "data-testid"?: string
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

export function FmpCandleChart({ bars, height = 420, "data-testid": testId }: FmpCandleChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const macdSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdSignalSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const macdHistSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const [chartError, setChartError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let chart: IChartApi | null = null
    let series: ISeriesApi<"Candlestick"> | null = null
    let volumeSeries: ISeriesApi<"Histogram"> | null = null
    let macdSeries: ISeriesApi<"Line"> | null = null
    let macdSignalSeries: ISeriesApi<"Line"> | null = null
    let macdHistSeries: ISeriesApi<"Histogram"> | null = null
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

      volumeSeries = chart.addSeries(HistogramSeries, {
        priceScaleId: "volume",
        color: "rgba(148,163,184,0.35)",
        base: 0,
      })
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

      series.priceScale().applyOptions({
        scaleMargins: { top: 0.06, bottom: 0.35 },
      })
      volumeSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.85, bottom: 0.02 },
        visible: false,
      })
      macdSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.7, bottom: 0.18 },
        visible: false,
      })

      chartRef.current = chart
      seriesRef.current = series
      volumeSeriesRef.current = volumeSeries
      macdSeriesRef.current = macdSeries
      macdSignalSeriesRef.current = macdSignalSeries
      macdHistSeriesRef.current = macdHistSeries

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
      const message = err instanceof Error ? err.message : "Chart init failed"
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChartError(message)
      chart?.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      macdSeriesRef.current = null
      macdSignalSeriesRef.current = null
      macdHistSeriesRef.current = null
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
    }
  }, [height])

  useEffect(() => {
    if (!seriesRef.current) return
    const candleData: CandlestickData[] = bars.map((bar) => ({
      time: Math.floor(bar.time / 1000) as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }))
    seriesRef.current.setData(candleData)
    if (volumeSeriesRef.current) {
      const volumeData: HistogramData[] = bars.map((bar) => ({
        time: Math.floor(bar.time / 1000) as Time,
        value: bar.volume ?? 0,
        color: bar.close >= bar.open ? "rgba(16,185,129,0.45)" : "rgba(239,68,68,0.45)",
      }))
      volumeSeriesRef.current.setData(volumeData)
    }
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
    if (bars.length && chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [bars])

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className="relative h-[420px] w-full rounded-lg border border-border/40 bg-muted/20"
    >
      {chartError ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-rose-500">
          {chartError}
        </div>
      ) : null}
      {!chartError && bars.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No chart data
        </div>
      ) : null}
    </div>
  )
}
