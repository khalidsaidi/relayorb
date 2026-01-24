const SESSION_TYPES = {
  RTH: "RTH",
}

const PREMARKET_OPEN_MINUTES = 4 * 60
const AFTERHOURS_CLOSE_MINUTES = 20 * 60

function resolveSessionBehavior(session = {}) {
  const normalized = String(session.type || SESSION_TYPES.RTH).toUpperCase()
  const includePremarket = session.include_premarket === true
  const includeAfterhours = session.include_afterhours === true

  if (normalized !== SESSION_TYPES.RTH) {
    return {
      type: SESSION_TYPES.RTH,
      isActive: () => false,
    }
  }

  return {
    type: SESSION_TYPES.RTH,
    isActive: (_time, market) => {
      if (!market || market.status === "weekend" || market.status === "holiday") {
        return false
      }
      const start = includePremarket ? PREMARKET_OPEN_MINUTES : market.openMinutes
      const end = includeAfterhours ? AFTERHOURS_CLOSE_MINUTES : market.closeMinutes
      return market.minutes >= start && market.minutes <= end
    },
  }
}

module.exports = {
  SESSION_TYPES,
  resolveSessionBehavior,
}
