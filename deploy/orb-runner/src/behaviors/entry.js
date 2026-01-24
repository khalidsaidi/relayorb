const ENTRY_TYPES = {
  ORB_RAW: "ORB_RAW",
  ORB_VWAP: "ORB_VWAP",
  ORB_ATR_BUFFER: "ORB_ATR_BUFFER",
  ORB_MULTI_BAR: "ORB_MULTI_BAR",
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
}

function resolveEntryBehavior(type, config = {}) {
  const normalized = String(type || "").toUpperCase()
  const atrBufferPct = isNumber(config.atrBufferPct) ? config.atrBufferPct : 0
  const confirmationBars = isNumber(config.confirmationBars)
    ? Math.max(1, Math.round(config.confirmationBars))
    : 1

  if (normalized === ENTRY_TYPES.ORB_VWAP) {
    return {
      type: ENTRY_TYPES.ORB_VWAP,
      shouldEnter: (ctx) =>
        isNumber(ctx?.price) &&
        isNumber(ctx?.orb_high) &&
        isNumber(ctx?.vwap) &&
        ctx.price > ctx.orb_high &&
        ctx.price > ctx.vwap,
    }
  }

  if (normalized === ENTRY_TYPES.ORB_ATR_BUFFER) {
    return {
      type: ENTRY_TYPES.ORB_ATR_BUFFER,
      shouldEnter: (ctx) => {
        if (!isNumber(ctx?.price) || !isNumber(ctx?.orb_high) || !isNumber(ctx?.atr)) {
          return false
        }
        const threshold = ctx.orb_high + ctx.atr * atrBufferPct
        return ctx.price > threshold
      },
    }
  }

  if (normalized === ENTRY_TYPES.ORB_MULTI_BAR) {
    return {
      type: ENTRY_TYPES.ORB_MULTI_BAR,
      shouldEnter: (ctx) =>
        isNumber(ctx?.orb_high) &&
        isNumber(ctx?.price) &&
        (ctx?.bars_since_breakout ?? 0) >= confirmationBars &&
        ctx.price > ctx.orb_high,
    }
  }

  return {
    type: ENTRY_TYPES.ORB_RAW,
    shouldEnter: (ctx) =>
      isNumber(ctx?.price) && isNumber(ctx?.orb_high) && ctx.price > ctx.orb_high,
  }
}

module.exports = {
  ENTRY_TYPES,
  resolveEntryBehavior,
}
