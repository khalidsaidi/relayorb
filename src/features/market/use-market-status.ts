import { useMemo } from "react"

export type MarketSessionStatus = "open" | "pre" | "after" | "closed"

export type MarketAssetStatus = {
  status: MarketSessionStatus
  isOpen: boolean
  label: string
  nextChange: Date | null
  timeUntilChange: number | null
}

export type MarketStatus = {
  stock: MarketAssetStatus
  crypto: MarketAssetStatus
  forex: MarketAssetStatus
}

// US Stock Market Hours (NYSE/NASDAQ) in Eastern Time
const US_MARKET_HOURS = {
  preMarketStart: 4 * 60,      // 4:00 AM ET in minutes
  regularStart: 9 * 60 + 30,   // 9:30 AM ET
  regularEnd: 16 * 60,         // 4:00 PM ET
  afterHoursEnd: 20 * 60,      // 8:00 PM ET
}

// NYSE holidays 2026
const US_MARKET_HOLIDAYS = new Set([
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
])

function getEasternTime(): {
  date: Date
  dayOfWeek: number
  minuteOfDay: number
  dateString: string
} {
  const now = new Date()

  // Use formatToParts to get ET components without timezone parsing ambiguity
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value || ''

  const hour = parseInt(get('hour'), 10)
  const minute = parseInt(get('minute'), 10)
  const year = get('year')
  const month = get('month')
  const day = get('day')

  // Map weekday name to day number
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dayOfWeek = weekdayMap[get('weekday')] ?? 0

  return {
    date: now,
    dayOfWeek,
    minuteOfDay: hour * 60 + minute,
    dateString: `${year}-${month}-${day}`,
  }
}

function getStockMarketStatus(): MarketAssetStatus {
  const et = getEasternTime()
  const isWeekend = et.dayOfWeek === 0 || et.dayOfWeek === 6
  const isHoliday = US_MARKET_HOLIDAYS.has(et.dateString)
  
  if (isWeekend || isHoliday) {
    return { 
      status: "closed", 
      isOpen: false, 
      label: isHoliday ? "Holiday" : "Weekend",
      nextChange: null,
      timeUntilChange: null,
    }
  }

  const { preMarketStart, regularStart, regularEnd, afterHoursEnd } = US_MARKET_HOURS
  const minute = et.minuteOfDay

  if (minute < preMarketStart) {
    return { 
      status: "closed", 
      isOpen: false, 
      label: "Closed",
      nextChange: null,
      timeUntilChange: (preMarketStart - minute) * 60 * 1000,
    }
  }
  if (minute < regularStart) {
    return { 
      status: "pre", 
      isOpen: false, 
      label: "Pre-Market",
      nextChange: null,
      timeUntilChange: (regularStart - minute) * 60 * 1000,
    }
  }
  if (minute < regularEnd) {
    return { 
      status: "open", 
      isOpen: true, 
      label: "Market Open",
      nextChange: null,
      timeUntilChange: (regularEnd - minute) * 60 * 1000,
    }
  }
  if (minute < afterHoursEnd) {
    return { 
      status: "after", 
      isOpen: false, 
      label: "After-Hours",
      nextChange: null,
      timeUntilChange: (afterHoursEnd - minute) * 60 * 1000,
    }
  }
  return { 
    status: "closed", 
    isOpen: false, 
    label: "Closed",
    nextChange: null,
    timeUntilChange: null,
  }
}

function getForexMarketStatus(): MarketAssetStatus {
  const et = getEasternTime()
  const isWeekend = et.dayOfWeek === 0 || et.dayOfWeek === 6
  const isFridayAfter5pm = et.dayOfWeek === 5 && et.minuteOfDay >= 17 * 60
  const isSundayBefore5pm = et.dayOfWeek === 0 && et.minuteOfDay < 17 * 60
  
  if ((isWeekend && et.dayOfWeek !== 0) || isFridayAfter5pm || isSundayBefore5pm) {
    return { status: "closed", isOpen: false, label: "Closed", nextChange: null, timeUntilChange: null }
  }
  return { status: "open", isOpen: true, label: "Open", nextChange: null, timeUntilChange: null }
}

/**
 * Hook to get current market status for all asset classes
 * Recalculates on each render (call this in components that need real-time status)
 */
export function useMarketStatus(): MarketStatus {
  return useMemo(() => ({
    stock: getStockMarketStatus(),
    crypto: { status: "open" as const, isOpen: true, label: "24/7", nextChange: null, timeUntilChange: null },
    forex: getForexMarketStatus(),
  }), [])
}

/**
 * Format time until market change in human-readable form
 */
export function formatTimeUntil(ms: number | null): string {
  if (ms === null) return ""
  if (ms < 0) return "now"
  
  const hours = Math.floor(ms / (60 * 60 * 1000))
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Get status color classes
 */
export function getMarketStatusColor(status: MarketSessionStatus): string {
  switch (status) {
    case "open":
      return "text-emerald-600 bg-emerald-500/15 border-emerald-500/30"
    case "pre":
    case "after":
      return "text-amber-600 bg-amber-500/15 border-amber-500/30"
    case "closed":
    default:
      return "text-slate-500 bg-slate-500/10 border-slate-500/20"
  }
}
