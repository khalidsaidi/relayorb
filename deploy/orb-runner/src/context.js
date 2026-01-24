function buildTradeContext({
  symbol,
  price,
  orbRange,
  vwap,
  atr,
  time,
  entryPrice,
  entryTime,
  barsSinceBreakout,
}) {
  const entryTimestamp = entryTime instanceof Date ? entryTime : null
  const minutesInTrade =
    entryTimestamp && time instanceof Date
      ? Math.max(0, Math.floor((time.getTime() - entryTimestamp.getTime()) / 60000))
      : null

  return {
    symbol,
    price,
    orb_high: orbRange?.high ?? null,
    orb_low: orbRange?.low ?? null,
    vwap: vwap ?? null,
    atr: atr ?? null,
    time,
    entry_price: entryPrice ?? null,
    entry_time: entryTimestamp,
    minutes_in_trade: minutesInTrade,
    bars_since_breakout: barsSinceBreakout ?? 0,
  }
}

module.exports = {
  buildTradeContext,
}
