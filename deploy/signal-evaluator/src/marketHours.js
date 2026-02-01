// Market hours utilities for Node.js backend
// Handles stock, forex, and crypto market hours with timezone awareness

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

const ET_TIME_ZONE = "America/New_York"
const ET_WEEKDAY_MAP = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}
const ET_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
  hour12: false,
})

function getEtParts(date) {
  const parts = ET_FORMATTER.formatToParts(date)
  const map = {}
  parts.forEach((part) => {
    map[part.type] = part.value
  })
  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  const second = Number(map.second)
  const weekday = ET_WEEKDAY_MAP[map.weekday] ?? 0
  return { year, month, day, hour, minute, second, weekday }
}

function getTimeZoneOffsetMs(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const map = {}
  parts.forEach((part) => {
    map[part.type] = part.value
  })
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  )
  return asUtc - date.getTime()
}

function makeEtDate({ year, month, day, hour, minute, second = 0 }) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second)
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), ET_TIME_ZONE)
  return new Date(utcGuess - offset)
}

/**
 * Convert a Date to ET timezone and format as YYYY-MM-DD
 */
function toETDateString(date) {
  const parts = getEtParts(date)
  const year = String(parts.year).padStart(4, "0")
  const month = String(parts.month).padStart(2, "0")
  const day = String(parts.day).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Get ET hours and minutes from a Date
 */
function getETTime(date) {
  const parts = getEtParts(date)
  return {
    hours: parts.hour,
    minutes: parts.minute,
    day: parts.weekday, // 0=Sunday, 6=Saturday
  }
}

/**
 * Check if a given date is a US stock market holiday
 */
function isUSHoliday(date) {
  const dateStr = toETDateString(date)
  return US_HOLIDAYS_2026_2027.includes(dateStr)
}

/**
 * Check if a given date is a weekend (Saturday or Sunday)
 */
function isWeekend(date) {
  const { day } = getETTime(date)
  return day === 0 || day === 6
}

/**
 * Check if stock market is open at given timestamp
 * Stocks: 9:30 AM - 4:00 PM ET, Monday-Friday, excluding holidays
 */
function isStockMarketOpen(timestamp) {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp

  if (isWeekend(date) || isUSHoliday(date)) {
    return false
  }

  const { hours, minutes } = getETTime(date)
  const timeInMinutes = hours * 60 + minutes
  const marketOpen = 9 * 60 + 30 // 9:30 AM
  const marketClose = 16 * 60 // 4:00 PM

  return timeInMinutes >= marketOpen && timeInMinutes < marketClose
}

/**
 * Check if forex market is open at given timestamp
 * Forex: Sunday 5:00 PM ET through Friday 5:00 PM ET (24/5)
 */
function isForexMarketOpen(timestamp) {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp
  const { day, hours } = getETTime(date)

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

  return true
}

/**
 * Check if crypto market is open (always true)
 */
function isCryptoMarketOpen() {
  return true
}

/**
 * Check if market is open for a given asset class
 */
function isMarketOpen(assetClass, timestamp) {
  switch (assetClass) {
    case "stock":
      return isStockMarketOpen(timestamp)
    case "forex":
      return isForexMarketOpen(timestamp)
    case "crypto":
      return isCryptoMarketOpen()
    default:
      return false
  }
}

/**
 * Add days to a date
 */
function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Add minutes to a date
 */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000)
}

/**
 * Set time on a date in ET timezone
 */
function setETTime(date, hours, minutes) {
  const parts = getEtParts(date)
  return makeEtDate({
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: hours,
    minute: minutes,
  })
}

/**
 * Get the next market open time for stocks
 */
function getNextStockMarketOpen(timestamp) {
  let date = new Date(typeof timestamp === "number" ? timestamp : timestamp.getTime())

  // If currently during market hours, start from next day
  if (isStockMarketOpen(date)) {
    date = addDays(date, 1)
  }

  // Find next weekday that's not a holiday
  let attempts = 0
  while (attempts < 14) {
    const { day } = getETTime(date)

    // Skip weekends
    if (day === 0) {
      // Sunday -> Monday
      date = addDays(date, 1)
    } else if (day === 6) {
      // Saturday -> Monday
      date = addDays(date, 2)
    }

    // Set to 9:30 AM ET
    date = setETTime(date, 9, 30)

    // Check if holiday
    if (!isUSHoliday(date)) {
      return date
    }

    // Try next day
    date = addDays(date, 1)
    attempts++
  }

  return date
}

/**
 * Get the next market open time for forex
 */
function getNextForexMarketOpen(timestamp) {
  let date = new Date(typeof timestamp === "number" ? timestamp : timestamp.getTime())

  // If currently open, return next week's open (Sunday 5 PM)
  if (isForexMarketOpen(date)) {
    const { day } = getETTime(date)
    const daysUntilSunday = day === 0 ? 7 : 7 - day
    date = addDays(date, daysUntilSunday)
  } else {
    // Market is closed, find next open
    const { day, hours } = getETTime(date)

    if (day === 5 && hours >= 17) {
      // Friday after 5 PM -> Sunday 5 PM
      date = addDays(date, 2)
    } else if (day === 6) {
      // Saturday -> Sunday 5 PM
      date = addDays(date, 1)
    }
    // else Sunday before 5 PM -> today at 5 PM
  }

  // Set to 5:00 PM ET
  return setETTime(date, 17, 0)
}

/**
 * Adjust evaluation time to account for market hours
 * If market is closed at the given time, shift to next market open
 */
function adjustEvaluationTime(assetClass, signalTime, horizonMinutes) {
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
      assetClass === "stock" ? getNextStockMarketOpen(signal) : getNextForexMarketOpen(signal)
    wasAdjusted = true
  }

  // Calculate horizon time from adjusted signal time
  let horizonTime = addMinutes(adjustedSignal, horizonMinutes)

  // Check if market is open at horizon time
  if (!isMarketOpen(assetClass, horizonTime)) {
    // Market closed during horizon, shift to next open
    horizonTime =
      assetClass === "stock" ? getNextStockMarketOpen(horizonTime) : getNextForexMarketOpen(horizonTime)
    wasAdjusted = true
  }

  return {
    adjustedSignalTime: adjustedSignal,
    adjustedHorizonTime: horizonTime,
    wasAdjusted,
  }
}

module.exports = {
  isMarketOpen,
  isStockMarketOpen,
  isForexMarketOpen,
  isCryptoMarketOpen,
  getNextStockMarketOpen,
  getNextForexMarketOpen,
  adjustEvaluationTime,
}
