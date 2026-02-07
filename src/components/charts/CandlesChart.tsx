import { useEffect, useMemo, useRef } from "react"
import {
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
} from "lightweight-charts"
import { ChartFrame } from "@/components/charts/ChartFrame"

export type Candle = {
  time: string // "YYYY-MM-DD" or ISO-ish string supported by lightweight-charts
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

function toCandlestickData(rows: Candle[]): CandlestickData[] {
  return rows
    .filter((r) => Number.isFinite(r.open) && Number.isFinite(r.high) && Number.isFinite(r.low) && Number.isFinite(r.close))
    .map((r) => ({
      time: r.time.slice(0, 10),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    }))
}

function toVolumeData(rows: Candle[]): HistogramData[] {
  return rows
    .filter((r) => typeof r.volume === "number" && Number.isFinite(r.volume))
    .map((r) => ({
      time: r.time.slice(0, 10),
      value: Number(r.volume || 0),
      // Green on up-candle, red on down-candle.
      color: r.close >= r.open ? "rgba(34, 197, 94, 0.55)" : "rgba(244, 63, 94, 0.55)",
    }))
}

function CandlesChartInner({
  width,
  height,
  candles,
}: {
  width: number
  height: number
  candles: Candle[]
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)

  const candleData = useMemo(() => toCandlestickData(candles), [candles])
  const volumeData = useMemo(() => toVolumeData(candles), [candles])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748b",
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.25)" },
        horzLines: { color: "rgba(148, 163, 184, 0.25)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: false,
      },
      crosshair: { mode: CrosshairMode.Normal },
    })

    // lightweight-charts v5: addSeries(definition, options)
    const candlesSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#e11d48",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#e11d48",
    })

    // Put volume into a separate pane under price. (v5 supports multiple panes via paneIndex)
	    const volSeries = chart.addSeries(
	      HistogramSeries,
	      {
	        color: "rgba(148, 163, 184, 0.35)",
	        base: 0,
	        priceFormat: { type: "volume" },
	        priceLineVisible: false,
	        lastValueVisible: false,
	      },
	      1
	    )

	    chartRef.current = chart
	    seriesRef.current = candlesSeries
	    volumeRef.current = volSeries

    // Initial data
    candlesSeries.setData(candleData)
    if (volumeData.length) volSeries.setData(volumeData)
    chart.timeScale().fitContent()

    return () => {
      chartRef.current = null
      seriesRef.current = null
      volumeRef.current = null
      chart.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chart.applyOptions({ width, height })
  }, [width, height])

  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(candleData)
    if (volumeRef.current) {
      if (volumeData.length) volumeRef.current.setData(volumeData)
      else volumeRef.current.setData([])
    }
    chartRef.current?.timeScale().fitContent()
  }, [candleData, volumeData])

  return <div ref={containerRef} style={{ width, height }} />
}

export function CandlesChart({
  candles,
  height = 260,
  className,
}: {
  candles: Candle[]
  height?: number
  className?: string
}) {
  if (!candles?.length) return null
  return (
    <ChartFrame height={height} className={className ? `min-h-[260px] ${className}` : "min-h-[260px]"}>
      {({ width, height: measured }) => (
        <CandlesChartInner width={width} height={measured} candles={candles} />
      )}
    </ChartFrame>
  )
}
