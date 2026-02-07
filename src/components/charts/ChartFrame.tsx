import { useEffect, useRef, useState, type ReactNode } from "react"

type Size = { width: number; height: number }

const MIN_CHART_SIDE_PX = 48

export function ChartFrame({
  height = 240,
  className,
  children,
}: {
  height?: number
  className?: string
  children: (size: Size) => ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Attempt an immediate measurement so charts render on first paint in stable layouts.
    // (ResizeObserver will keep it updated after this.)
    try {
      const rect = el.getBoundingClientRect()
      const initial = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      if (
        Number.isFinite(initial.width) &&
        Number.isFinite(initial.height) &&
        initial.width >= MIN_CHART_SIDE_PX &&
        initial.height >= MIN_CHART_SIDE_PX
      ) {
        setSize(initial)
      }
    } catch {
      // ignore
    }

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      // Guard against rare cases where an embedded browser reports NaN sizes during layout.
      // Recharts treats those as invalid and will warn loudly.
      if (!Number.isFinite(next.width) || !Number.isFinite(next.height)) return
      // Some layouts (hidden tabs, collapsed panels) can report extremely small sizes.
      // Instead of keeping the last "good" size (which can cause chart libs to warn),
      // explicitly unmount children until the container is visible again.
      if (next.width < MIN_CHART_SIDE_PX || next.height < MIN_CHART_SIDE_PX) {
        setSize((prev) => (prev ? null : prev))
        return
      }
      setSize((prev) => {
        if (prev && prev.width === next.width && prev.height === next.height) return prev
        return next
      })
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={className ? `w-full min-w-0 ${className}` : "w-full min-w-0"}
      style={{ height, minHeight: height }}
    >
      {size ? children(size) : null}
    </div>
  )
}
