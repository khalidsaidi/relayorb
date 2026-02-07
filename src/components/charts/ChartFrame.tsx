import { useEffect, useRef, useState, type ReactNode } from "react"

type Size = { width: number; height: number }

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

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = { width: Math.floor(rect.width), height: Math.floor(rect.height) }
      if (next.width <= 0 || next.height <= 0) return
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
