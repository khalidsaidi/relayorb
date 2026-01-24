const EXIT_TYPES = {
  FIXED_STOP: "FIXED_STOP",
  TRAILING_STOP: "TRAILING_STOP",
  REMEMBERED_ORB_STOP: "REMEMBERED_ORB_STOP",
  TIME_STOP: "TIME_STOP",
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function resolveExitBehavior(type, config = {}) {
  const normalized = String(type || "").toUpperCase()
  const stopPct = isNumber(config.stopPct) ? config.stopPct : null
  const timeStopMinutes = isNumber(config.timeStopMinutes)
    ? Math.max(1, Math.round(config.timeStopMinutes))
    : null

  const stopFromPct = (price) => {
    if (!isNumber(price) || !isNumber(stopPct)) return null
    return price * (1 - stopPct / 100)
  }

  if (normalized === EXIT_TYPES.TRAILING_STOP) {
    return {
      type: EXIT_TYPES.TRAILING_STOP,
      initialStop: (ctx) => stopFromPct(ctx?.entry_price ?? ctx?.price),
      updateStop: (ctx, previousStop) => {
        const next = stopFromPct(ctx?.price)
        if (!isNumber(previousStop)) return next
        if (!isNumber(next)) return previousStop
        return Math.max(previousStop, next)
      },
      shouldExit: (ctx, stop) =>
        isNumber(stop) && isNumber(ctx?.price) && ctx.price <= stop,
    }
  }

  if (normalized === EXIT_TYPES.REMEMBERED_ORB_STOP) {
    return {
      type: EXIT_TYPES.REMEMBERED_ORB_STOP,
      initialStop: (ctx) => (isNumber(ctx?.orb_low) ? ctx.orb_low : null),
      updateStop: (ctx) => (isNumber(ctx?.orb_low) ? ctx.orb_low : null),
      shouldExit: (ctx, stop) =>
        isNumber(stop) && isNumber(ctx?.price) && ctx.price <= stop,
    }
  }

  if (normalized === EXIT_TYPES.TIME_STOP) {
    return {
      type: EXIT_TYPES.TIME_STOP,
      initialStop: () => null,
      updateStop: (_ctx, previousStop) => previousStop ?? null,
      shouldExit: (ctx) =>
        isNumber(ctx?.minutes_in_trade) &&
        isNumber(timeStopMinutes) &&
        ctx.minutes_in_trade >= timeStopMinutes,
    }
  }

  return {
    type: EXIT_TYPES.FIXED_STOP,
    initialStop: (ctx) => stopFromPct(ctx?.entry_price ?? ctx?.price),
    updateStop: (ctx, previousStop) => previousStop ?? stopFromPct(ctx?.entry_price ?? ctx?.price),
    shouldExit: (ctx, stop) =>
      isNumber(stop) && isNumber(ctx?.price) && ctx.price <= stop,
  }
}

module.exports = {
  EXIT_TYPES,
  resolveExitBehavior,
}
