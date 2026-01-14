import { useEffect, useState } from "react"

/**
 * Returns a timestamp that updates on a fixed interval.
 * Useful for time-based visuals without calling Date.now() during render.
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
