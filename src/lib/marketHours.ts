import { fromZonedTime, toZonedTime, format } from "date-fns-tz"
import { addDays, addMinutes, set, getDay, isAfter } from "date-fns"

export type AssetClass = "crypto" | "stock" | "forex"

export type MarketStatus = {
  assetClass: AssetClass
  isOpen: boolean
  nextChange: Date
  nextChangeLabel: string
  countdown: string
  hoursText: string
}

// US stock market holidays for 2026-2027
const US_HOLIDAYS_2026_2027 = [
  "2026-01-01", // New Year's Day
  "2026-01-19", // Martin Luther King Jr. Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-07-03", // Independence Day (observed)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
  "2027-01-01", // New Year's Day
  "2027-01-18", // Martin Luther King Jr. Day
  "2027-02-15", // Presidents' Day
  "2027-03-26", // Good Friday
  "2027-05-31", // Memorial Day
  "2027-07-05", // Independence Day (observed)
  "2027-09-06", // Labor Day
  "2027-11-25", // Thanksgiving
  "2027-12-24", // Christmas (observed)
]

const ET_TIMEZONE = "America/New_York"

/**
 * Check if a given date is a US stock market holiday
 */
function isUSHoliday(date: Date): boolean {
  const etDate = toZonedTime(date, ET_TIMEZONE)
  const dateStr = format(etDate, "yyyy-MM-dd", { timeZone: ET_TIMEZONE })
  return US_HOLIDAYS_2026_2027.includes(dateStr)
}

/**
 * Check if a given date is a weekend (Saturday or Sunday)
 */
function isWeekend(date: Date): boolean {
  const day = getDay(date)
  return day === 0 || day === 6 // Sunday or Saturday
}

/**
 * Check if stock market is open at given timestamp
 * Stocks: 9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays
 */
export function isStockMarketOpen(timestamp: Date | number): boolean {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp
  const etTime = toZonedTime(date, ET_TIMEZONE)

  // Check if weekend or holiday
  if (isWeekend(etTime) || isUSHoliday(etTime)) {
    return false
  }

  const hours = etTime.getHours()
  const minutes = etTime.getMinutes()
  const timeInMinutes = hours * 60 + minutes

  const marketOpen = 9 * 60 + 30 // 9:30 AM
  const marketClose = 16 * 60 // 4:00 PM

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose
}

/**
 * Check if forex market is open at given timestamp
 * Forex: Sunday 5:00 PM ET through Friday 5:00 PM ET (24/5)
 */
export function isForexMarketOpen(timestamp: Date | number): boolean {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp
  const etTime = toZonedTime(date, ET_TIMEZONE)

  const day = getDay(etTime)
  const hours = etTime.getHours()

  // Friday after 5 PM ET - closed
  if (day === 5 && hours >= 17) {
    return false
  }

  // Saturday - closed
  if (day === 6) {
    return false
  }

  // Sunday before 5 PM ET - closed
  if (day === 0 && hours < 17) {
    return false
  }

  // All other times - open
  return true
}

/**
 * Check if crypto market is open (always true)
 */
export function isCryptoMarketOpen(_timestamp: Date | number): boolean {
  return true // Crypto trades 24/7
}

/**
 * Check if market is open for a given asset class
 */
export function isMarketOpen(assetClass: AssetClass, timestamp: Date | number): boolean {
  switch (assetClass) {
    case "stock":
      return isStockMarketOpen(timestamp)
    case "forex":
      return isForexMarketOpen(timestamp)
    case "crypto":
      return isCryptoMarketOpen(timestamp)
    default:
      return false
  }
}

/**
 * Get the next market open time for stocks
 */
export function getNextStockMarketOpen(timestamp: Date | number): Date {
  let date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp.getTime())
  let etTime = toZonedTime(date, ET_TIMEZONE)

  // Calculate today's market open time for comparison
  const todayMarketOpen = set(etTime, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 })

  // If currently during market hours, OR if it's already past market open time today,
  // we start looking from tomorrow
  if (isStockMarketOpen(date) || isAfter(etTime, todayMarketOpen)) {
    etTime = addDays(etTime, 1)
  }

  // Find next weekday that's not a holiday
  let attempts = 0
  while (attempts < 14) {
    // Safety limit
    const day = getDay(etTime)

    // If weekend, skip to Monday
    if (day === 0) {
      // Sunday
      etTime = addDays(etTime, 1)
    } else if (day === 6) {
      // Saturday
      etTime = addDays(etTime, 2)
    }

    // Set to 9:30 AM ET
    etTime = set(etTime, { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 })

    // Check if holiday
    if (!isUSHoliday(etTime)) {
      // Convert back to UTC
      return fromZonedTime(etTime, ET_TIMEZONE)
    }

    // Try next day
    etTime = addDays(etTime, 1)
    attempts++
  }

  // Fallback (should never reach here)
  return fromZonedTime(etTime, ET_TIMEZONE)
}

/**
 * Get the next market close time for stocks
 */
export function getNextStockMarketClose(timestamp: Date | number): Date {
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp.getTime())

  // If market is closed, get next open first
  if (!isStockMarketOpen(date)) {
    const nextOpen = getNextStockMarketOpen(date)
    const etNextOpen = toZonedTime(nextOpen, ET_TIMEZONE)
    const etClose = set(etNextOpen, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 })
    return fromZonedTime(etClose, ET_TIMEZONE)
  }

  // Market is open, close is today at 4 PM ET
  const etTime = toZonedTime(date, ET_TIMEZONE)
  const etClose = set(etTime, { hours: 16, minutes: 0, seconds: 0, milliseconds: 0 })
  return fromZonedTime(etClose, ET_TIMEZONE)
}

/**
 * Get the next market open time for forex
 */
export function getNextForexMarketOpen(timestamp: Date | number): Date {
  let date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp.getTime())
  let etTime = toZonedTime(date, ET_TIMEZONE)

  // If currently open, return next week's open (Sunday 5 PM)
  if (isForexMarketOpen(date)) {
    // Find next Sunday
    const currentDay = getDay(etTime)
    const daysUntilSunday = currentDay === 0 ? 7 : 7 - currentDay
    etTime = addDays(etTime, daysUntilSunday)
  } else {
    // Market is closed, find next open
    const currentDay = getDay(etTime)
    const hours = etTime.getHours()

    if (currentDay === 5 && hours >= 17) {
      // Friday after 5 PM - opens Sunday 5 PM
      const daysUntilSunday = 2
      etTime = addDays(etTime, daysUntilSunday)
    } else if (currentDay === 6) {
      // Saturday - opens Sunday 5 PM
      etTime = addDays(etTime, 1)
    } else if (currentDay === 0 && hours < 17) {
      // Sunday before 5 PM - opens today at 5 PM
      // Keep same day
    }
  }

  // Set to 5:00 PM ET
  etTime = set(etTime, { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 })
  return fromZonedTime(etTime, ET_TIMEZONE)
}

/**
 * Get the next market close time for forex
 */
export function getNextForexMarketClose(timestamp: Date | number): Date {
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp.getTime())

  // If market is closed, get next open first
  if (!isForexMarketOpen(date)) {
    const nextOpen = getNextForexMarketOpen(date)
    const etNextOpen = toZonedTime(nextOpen, ET_TIMEZONE)
    // Find next Friday 5 PM from that open
    const dayOfOpen = getDay(etNextOpen)
    const daysUntilFriday = (5 - dayOfOpen + 7) % 7
    const etClose = addDays(etNextOpen, daysUntilFriday)
    const etCloseTime = set(etClose, { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 })
    return fromZonedTime(etCloseTime, ET_TIMEZONE)
  }

  // Market is open, find next Friday 5 PM
  const etTime = toZonedTime(date, ET_TIMEZONE)
  const currentDay = getDay(etTime)
  const daysUntilFriday = currentDay <= 5 ? 5 - currentDay : 0

  let etClose = addDays(etTime, daysUntilFriday)
  etClose = set(etClose, { hours: 17, minutes: 0, seconds: 0, milliseconds: 0 })

  // If we're on Friday after close time, it's already closed, so this shouldn't happen
  // but just in case, return the calculated time
  return fromZonedTime(etClose, ET_TIMEZONE)
}

/**
 * Get next market change time (open or close) for any asset class
 */
export function getNextMarketChange(assetClass: AssetClass, timestamp?: Date | number): Date {
  const date = timestamp ? (typeof timestamp === "number" ? new Date(timestamp) : timestamp) : new Date()

  switch (assetClass) {
    case "stock":
      return isStockMarketOpen(date)
        ? getNextStockMarketClose(date)
        : getNextStockMarketOpen(date)
    case "forex":
      return isForexMarketOpen(date)
        ? getNextForexMarketClose(date)
        : getNextForexMarketOpen(date)
    case "crypto":
      return new Date(Date.now() + 1000 * 60 * 60 * 24 * 365) // Never (1 year from now)
    default:
      return new Date()
  }
}

/**
 * Format a duration in milliseconds as a countdown string
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "now"

  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (minutes > 0) {
    return `${minutes}m`
  }

  return `${seconds}s`
}

/**
 * Get market hours text for display
 */
export function getMarketHoursText(assetClass: AssetClass): string {
  switch (assetClass) {
    case "stock":
      return "NYSE: 9:30 AM - 4:00 PM ET (Mon-Fri)"
    case "forex":
      return "FX: 24/5 (Sun 5 PM - Fri 5 PM ET)"
    case "crypto":
      return "Crypto: 24/7"
    default:
      return ""
  }
}

/**
 * Get current market status for an asset class
 */
export function getMarketStatus(assetClass: AssetClass): MarketStatus {
  const now = new Date()
  const isOpen = isMarketOpen(assetClass, now)
  const nextChange = getNextMarketChange(assetClass, now)
  const msUntilChange = nextChange.getTime() - now.getTime()

  return {
    assetClass,
    isOpen,
    nextChange,
    nextChangeLabel: isOpen ? "Closes in" : "Opens in",
    countdown: formatCountdown(msUntilChange),
    hoursText: getMarketHoursText(assetClass),
  }
}

/**
 * Adjust evaluation time to account for market hours
 * If market is closed at the given time, shift to next market open
 */
export function adjustEvaluationTime(
  assetClass: AssetClass,
  signalTime: Date | number,
  horizonMinutes: number
): { adjustedSignalTime: Date; adjustedHorizonTime: Date; wasAdjusted: boolean } {
  const signal = typeof signalTime === "number" ? new Date(signalTime) : new Date(signalTime.getTime())

  // Crypto is always open, no adjustment needed
  if (assetClass === "crypto") {
    return {
      adjustedSignalTime: signal,
      adjustedHorizonTime: addMinutes(signal, horizonMinutes),
      wasAdjusted: false,
    }
  }

  // Check if market was open at signal time
  let adjustedSignal = signal
  let wasAdjusted = false

  if (!isMarketOpen(assetClass, signal)) {
    // Market was closed, shift to next open
    adjustedSignal =
      assetClass === "stock"
        ? getNextStockMarketOpen(signal)
        : getNextForexMarketOpen(signal)
    wasAdjusted = true
  }

  // Calculate horizon time from adjusted signal time
  let horizonTime = addMinutes(adjustedSignal, horizonMinutes)

  // Check if market is open at horizon time
  if (!isMarketOpen(assetClass, horizonTime)) {
    // Market closed during horizon, shift to next open
    horizonTime =
      assetClass === "stock"
        ? getNextStockMarketOpen(horizonTime)
        : getNextForexMarketOpen(horizonTime)
    wasAdjusted = true
  }

  return {
    adjustedSignalTime: adjustedSignal,
    adjustedHorizonTime: horizonTime,
    wasAdjusted,
  }
}
