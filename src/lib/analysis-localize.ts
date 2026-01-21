import type { TFunction } from "i18next"
import type { MarketTradeAnalysis } from "@/lib/types"

type LocalizedAnalysis = {
  summary?: string
  details?: string[]
}

export type AnalysisNoteKind = "llm" | "rules"

const SUMMARY_REGEX = /^([A-Z]+) signal(?:\s+\u00b7\s+(.*))?\.$/

function mapSummaryTimeLabel(value: string, t: TFunction) {
  const match = value.match(/^(\d+)([mhd])$/)
  if (!match) return value
  const amount = Number.parseInt(match[1], 10)
  const unit = match[2]
  let key = ""
  if (unit === "m") {
    key = amount === 1 ? "m1" : amount === 5 ? "m5" : amount === 15 ? "m15" : amount === 30 ? "m30" : ""
  }
  if (unit === "h") {
    key = amount === 1 ? "h1" : amount === 24 ? "h24" : ""
  }
  if (unit === "d") {
    key = amount === 7 ? "d7" : ""
  }
  return key ? t(`analysis.time.${key}`, { defaultValue: value }) : value
}

function translateSummaryBit(bit: string, t: TFunction) {
  const moveMatch = bit.match(/^(\d+)(m|h|d)\s+([-+]?\d+(?:\.\d+)?%)$/)
  if (moveMatch) {
    const label = mapSummaryTimeLabel(`${moveMatch[1]}${moveMatch[2]}`, t)
    return t("analysis.summary.move", { label, value: moveMatch[3] })
  }
  const botsMatch = bit.match(/^bots\s+(\d+)\/(\d+)$/)
  if (botsMatch) {
    return t("analysis.summary.bots", { buy: botsMatch[1], sell: botsMatch[2] })
  }
  const scoreMatch = bit.match(/^score\s+(\d+(?:\.\d+)?)$/)
  if (scoreMatch) {
    return t("analysis.summary.score", { score: scoreMatch[1] })
  }
  if (bit === "swing overnight" || bit === "overnight swing") {
    return t("analysis.summary.swingOvernight")
  }
  if (bit === "pre-breakout watch") {
    return t("analysis.summary.prebreakout")
  }
  return bit
}

function translateSummary(summary: string, t: TFunction) {
  const match = summary.match(SUMMARY_REGEX)
  if (!match) return null
  const side = match[1].toLowerCase()
  const sideLabel = t(`analysis.side.${side}`, { defaultValue: match[1] })
  const bits = match[2]
    ? match[2].split(/\s*\u00b7\s*/).map((bit) => translateSummaryBit(bit, t))
    : []
  const base = t("analysis.summary.signal", { side: sideLabel })
  const separator = t("analysis.summary.separator", { defaultValue: " \u00b7 " })
  const suffix = t("analysis.summary.sentenceSuffix", { defaultValue: "." })
  return bits.length > 0 ? `${base}${separator}${bits.join(separator)}${suffix}` : `${base}${suffix}`
}

function parseEnglishList(value: string) {
  const cleaned = value.trim().replace(/\.$/, "")
  if (!cleaned) return []
  const parts = cleaned.split(",").map((part) => part.trim())
  if (parts.length === 1) {
    return cleaned.split(" and ").map((part) => part.trim()).filter(Boolean)
  }
  const lastIndex = parts.length - 1
  parts[lastIndex] = parts[lastIndex].replace(/^and\s+/i, "").trim()
  return parts.filter(Boolean)
}

function joinLocalizedList(items: string[], t: TFunction) {
  if (items.length === 0) return ""
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]}${t("analysis.list.and")}${items[1]}`
  const comma = t("analysis.list.comma")
  const head = items.slice(0, -1).join(comma)
  return `${head}${t("analysis.list.and")}${items[items.length - 1]}`
}

function translateDriversList(value: string, t: TFunction) {
  const map: Record<string, string> = {
    momentum: t("analysis.labels.driverMomentum"),
    "bot consensus": t("analysis.labels.driverBotConsensus"),
    liquidity: t("analysis.labels.driverLiquidity"),
    "news sentiment": t("analysis.labels.driverNews"),
    "universe boost": t("analysis.labels.driverUniverse"),
  }
  const items = parseEnglishList(value).map((item) => map[item] || item)
  return joinLocalizedList(items, t)
}

function translatePenaltyList(value: string, t: TFunction) {
  const map: Record<string, string> = {
    spread: t("analysis.labels.penaltySpread"),
    liquidity: t("analysis.labels.penaltyLiquidity"),
    price: t("analysis.labels.penaltyPrice"),
    volume: t("analysis.labels.penaltyVolume"),
    sentiment: t("analysis.labels.penaltySentiment"),
  }
  const items = parseEnglishList(value).map((item) => map[item] || item)
  return joinLocalizedList(items, t)
}

function translateScoreModelParts(value: string, t: TFunction) {
  const map: Record<string, string> = {
    momentum: t("analysis.labels.scoreModelMomentum"),
    consensus: t("analysis.labels.scoreModelConsensus"),
    liquidity: t("analysis.labels.scoreModelLiquidity"),
    news: t("analysis.labels.scoreModelNews"),
    universe: t("analysis.labels.scoreModelUniverse"),
    analyst: t("analysis.labels.scoreModelAnalyst"),
    "spread penalty": t("analysis.labels.scoreModelSpreadPenalty"),
    "liquidity penalty": t("analysis.labels.scoreModelLiquidityPenalty"),
    "price penalty": t("analysis.labels.scoreModelPricePenalty"),
    "volume penalty": t("analysis.labels.scoreModelVolumePenalty"),
    "sentiment penalty": t("analysis.labels.scoreModelSentimentPenalty"),
  }
  return value
    .split(" + ")
    .map((part) => {
      const match = part.match(/^(.+?)\s+(-?\d+(?:\.\d+)?)$/)
      if (!match) return part
      const label = map[match[1]] || match[1]
      return `${label} ${match[2]}`
    })
    .join(" + ")
}

function translateTrendDrivers(value: string, t: TFunction) {
  const strengthMap: Record<string, string> = {
    strong: t("analysis.labels.trendStrengthStrong"),
    moderate: t("analysis.labels.trendStrengthModerate"),
    light: t("analysis.labels.trendStrengthLight"),
    weak: t("analysis.labels.trendStrengthWeak"),
    none: t("analysis.labels.trendStrengthNone"),
  }
  const match = value.match(
    /^Trend drivers:\s+momentum\s+(\w+),\s+consensus\s+(\w+),\s+liquidity\s+(\w+),\s+and\s+news\s+(\w+)\.$/
  )
  if (!match) return null
  return t("analysis.lines.trendDrivers", {
    momentum: strengthMap[match[1]] || match[1],
    consensus: strengthMap[match[2]] || match[2],
    liquidity: strengthMap[match[3]] || match[3],
    news: strengthMap[match[4]] || match[4],
  })
}

function translateRecommendation(line: string, t: TFunction) {
  const match = line.match(
    /^Recommendation:\s+([A-Z]+)\s+\u00b7\s+hold\s+([^\u00b7]+)\s+\u00b7\s+SL\s+([^\u00b7]+)\s+\u00b7\s+TP\s+(.+)\.$/
  )
  if (!match) return null
  const actionMap: Record<string, string> = {
    BUY: t("analysis.labels.recommendationBuy"),
    SELL: t("analysis.labels.recommendationSell"),
    HOLD: t("analysis.labels.recommendationHold"),
  }
  const holdRaw = match[2].trim()
  const hold = holdRaw === "n/a"
    ? t("common.na")
    : holdRaw.replace(/(\d+)m$/, (_, minutes) => `${minutes}${t("analysis.units.minute")}`)
  const normalizeNa = (value: string) => (value === "n/a" ? t("common.na") : value)
  return t("analysis.lines.recommendation", {
    action: actionMap[match[1]] || match[1],
    hold,
    stop: normalizeNa(match[3].trim()),
    take: normalizeNa(match[4].trim()),
  })
}

function translateRationaleSegment(segment: string, t: TFunction) {
  const botsMatch = segment.match(/^(\d+)\/(\d+)\s+bots signal buy$/)
  if (botsMatch) {
    return t("analysis.note.botsSignalBuy", { buy: botsMatch[1], total: botsMatch[2] })
  }

  const momentumMatch = segment.match(/^momentum\s+(.+)$/)
  if (momentumMatch) {
    const moves = momentumMatch[1].split("/").map((move) => {
      const match = move.trim().match(/^(\d+)(m|h|d)\s+([-+]?\d+(?:\.\d+)?%)$/)
      if (!match) return move.trim()
      const label = mapSummaryTimeLabel(`${match[1]}${match[2]}`, t)
      return t("analysis.summary.move", { label, value: match[3] })
    })
    return t("analysis.note.momentum", { moves: moves.join("/") })
  }

  const timeMoveMatch = segment.match(/^(\d+)(m|h|d)\s+move\s+([-+]?\d+(?:\.\d+)?%)$/)
  if (timeMoveMatch) {
    const label = mapSummaryTimeLabel(`${timeMoveMatch[1]}${timeMoveMatch[2]}`, t)
    return t("analysis.note.timeMove", { label, value: timeMoveMatch[3] })
  }

  if (segment === "dip setup") return t("analysis.note.dipSetup")
  if (segment === "scalp momentum") return t("analysis.note.scalpMomentum")
  if (segment === "liquidity strong") return t("analysis.note.liquidityStrong")
  if (segment === "in your universe") return t("analysis.note.inUniverse")
  if (segment === "primary focus") return t("analysis.note.primaryFocus")
  if (segment === "high momentum") return t("analysis.note.highMomentum")

  return segment
}

function translateRationaleNote(note: string, t: TFunction) {
  const parts = note.split(/\s*\u2022\s*/).map((part) => translateRationaleSegment(part.trim(), t))
  const separator = " \u2022 "
  return parts.join(separator)
}

function translateDetail(line: string, t: TFunction) {
  const scoreMatch = line.match(/^Score:\s+(\d+(?:\.\d+)?)\/100(?:\s+\((.+)\))?\.$/)
  if (scoreMatch) {
    const profile = scoreMatch[2]
    const profileLabel = profile
      ? t(`analysis.profileLabels.${profile}`, { defaultValue: profile })
      : ""
    const profileSuffix = profileLabel
      ? t("analysis.lines.profileSuffix", { profile: profileLabel })
      : ""
    return t("analysis.lines.score", { score: scoreMatch[1], profile: profileSuffix })
  }

  if (line === "Momentum: not available.") {
    return t("analysis.lines.momentumEmpty")
  }
  const momentumMatch = line.match(/^Momentum:\s+(.+)\.$/)
  if (momentumMatch) {
    const moves = momentumMatch[1].split(",").map((part) => part.trim())
    const translatedMoves = moves.map((move) => {
      const match = move.match(/^(\d+)(m|h|d)\s+([-+]?\d+(?:\.\d+)?%)$/)
      if (!match) return move
      const label = mapSummaryTimeLabel(`${match[1]}${match[2]}`, t)
      return t("analysis.summary.move", { label, value: match[3] })
    })
    const comma = t("analysis.list.comma")
    return t("analysis.lines.momentum", { moves: translatedMoves.join(comma) })
  }

  const botsNoneMatch = line.match(/^Bots:\s+no signals in the last\s+(\d+)\s+minutes\.$/)
  if (botsNoneMatch) {
    return t("analysis.lines.botsNone", { minutes: botsNoneMatch[1] })
  }

  const botsMatch = line.match(
    /^Bots:\s+(\d+)\s+signals\s+\((\d+)\s+buy,\s+(\d+)\s+sell\),\s+([^.]+)\.(.*)$/
  )
  if (botsMatch) {
    const biasMap: Record<string, string> = {
      mixed: t("analysis.labels.biasMixed"),
      "leaning buy": t("analysis.labels.biasLeaningBuy"),
      "leaning sell": t("analysis.labels.biasLeaningSell"),
    }
    const rest = botsMatch[5] || ""
    const strengthMatch = rest.match(/Avg strength\s+([\d.]+)\./)
    const recentMatch = rest.match(/Recent\s+(\d+)\s+in\s+(\d+)m\s+\(min\s+(\d+)\)\./)
    const strength = strengthMatch ? t("analysis.lines.botsStrength", { value: strengthMatch[1] }) : ""
    const recent = recentMatch
      ? t("analysis.lines.botsRecent", {
          count: Number(recentMatch[1]),
          minutes: Number(recentMatch[2]),
          min: Number(recentMatch[3]),
        })
      : ""
    return t("analysis.lines.bots", {
      total: Number(botsMatch[1]),
      buy: Number(botsMatch[2]),
      sell: Number(botsMatch[3]),
      bias: biasMap[botsMatch[4]] || botsMatch[4],
      strength,
      recent,
    })
  }

  if (line === "Score is driven mostly by limited data.") {
    return t("analysis.lines.scoreDriversLimited")
  }

  const penaltiesMatch = line.match(/^Score is muted by penalties:\s+(.+)\.$/)
  if (penaltiesMatch) {
    return t("analysis.lines.scoreDriversPenalties", {
      penalties: translatePenaltyList(penaltiesMatch[1], t),
    })
  }

  const driversMatch = line.match(/^Top drivers:\s+(.+)\.(?:\s+Penalties:\s+(.+)\.)?$/)
  if (driversMatch) {
    const penalties = driversMatch[2]
      ? t("analysis.lines.scoreDriversPenaltiesSuffix", {
          penalties: translatePenaltyList(driversMatch[2], t),
        })
      : ""
    return t("analysis.lines.scoreDriversTop", {
      drivers: translateDriversList(driversMatch[1], t),
      penalties,
    })
  }

  const weightedMatch = line.match(
    /^Bot consensus is weighted by recent\s+([^)]+)\s+accuracy\s+\(([\d.]+)% hit rate\)\.$/
  )
  if (weightedMatch) {
    return t("analysis.lines.consensusWeighted", {
      horizon: weightedMatch[1],
      hitRate: weightedMatch[2],
    })
  }

  const confidenceMatch = line.match(
    /^Confidence:\s+(\w+)\s+\((\d+)%\)(?:\s+based on\s+(\d+)\s+recent signals)?\.$/
  )
  if (confidenceMatch) {
    const labelMap: Record<string, string> = {
      high: t("analysis.labels.confidenceHigh"),
      medium: t("analysis.labels.confidenceMedium"),
      low: t("analysis.labels.confidenceLow"),
    }
    const basis = confidenceMatch[3]
      ? t("analysis.lines.confidenceBasis", { count: Number(confidenceMatch[3]) })
      : ""
    return t("analysis.lines.confidence", {
      label: labelMap[confidenceMatch[1]] || confidenceMatch[1],
      pct: confidenceMatch[2],
      basis,
    })
  }

  const trendCheckMatch = line.match(/^Trend check\s+\(([^)]+)\):\s+([\d.]+)\/100\.$/)
  if (trendCheckMatch) {
    return t("analysis.lines.trendCheck", { horizon: trendCheckMatch[1], score: trendCheckMatch[2] })
  }
  const trendCheckEmptyMatch = line.match(/^Trend check\s+\(([^)]+)\):\s+no data yet\.$/)
  if (trendCheckEmptyMatch) {
    return t("analysis.lines.trendCheckEmpty", { horizon: trendCheckEmptyMatch[1] })
  }

  const trendDrivers = translateTrendDrivers(line, t)
  if (trendDrivers) return trendDrivers

  const trendPenaltiesMatch = line.match(/^Trend penalties:\s+(.+)\.$/)
  if (trendPenaltiesMatch) {
    return t("analysis.lines.trendPenalties", { penalties: translatePenaltyList(trendPenaltiesMatch[1], t) })
  }

  const newsMatch = line.match(/^News sentiment:\s+([-+]?[\d.]+)\s+from\s+(\d+)\s+headlines\.$/)
  if (newsMatch) {
    return t("analysis.lines.newsSentiment", { sentiment: newsMatch[1], count: Number(newsMatch[2]) })
  }
  if (line === "News sentiment: no recent headlines, so no sentiment boost.") {
    return t("analysis.lines.newsSentimentEmpty")
  }

  const scoreModelMatch = line.match(/^Score model:\s+(.+)\s+=\s+([\d.]+)\.$/)
  if (scoreModelMatch) {
    return t("analysis.lines.scoreModel", {
      parts: translateScoreModelParts(scoreModelMatch[1], t),
      total: scoreModelMatch[2],
    })
  }

  const recommendation = translateRecommendation(line, t)
  if (recommendation) return recommendation

  const swingTrend = line.match(
    /^Swing trend:\s+price above MA(\d+)\/MA(\d+) and MA\1 rising\.$/
  )
  if (swingTrend) {
    return t("analysis.lines.swingTrend", { maShort: swingTrend[1], maLong: swingTrend[2] })
  }

  const swingEntry = line.match(/^Entry window:\s+last\s+(\d+)m before close\.$/)
  if (swingEntry) {
    return t("analysis.lines.swingEntryWindow", { minutes: swingEntry[1] })
  }

  const swingPullback = line.match(
    /^Pullback window:\s+range position\s+([\d.]+)%\s+\(<=\s+([\d.]+)%\)\.$/
  )
  if (swingPullback) {
    return t("analysis.lines.swingPullback", {
      position: swingPullback[1],
      max: swingPullback[2],
    })
  }

  const swingLateVolume = line.match(
    /^Late volume:\s+last\s+(\d+)m\s+(.+)\s+vs\s+(\d+)d avg\s+(.+)\.$/
  )
  if (swingLateVolume) {
    return t("analysis.lines.swingLateVolume", {
      window: swingLateVolume[1],
      last: swingLateVolume[2],
      lookback: swingLateVolume[3],
      avg: swingLateVolume[4],
    })
  }

  const swingDistribution = line.match(
    /^Distribution days\s+\((\d+)d\):\s+(\d+)\s+\(max\s+(\d+)\)\.$/
  )
  if (swingDistribution) {
    return t("analysis.lines.swingDistribution", {
      lookback: swingDistribution[1],
      count: Number(swingDistribution[2]),
      max: swingDistribution[3],
    })
  }

  const swingExit = line.match(
    /^Exit plan:\s+\+([\d.]+%?) pop by (\d+)m,\s+else exit by (.+) or MA(\d+) - ([\d.]+) ATR\.$/
  )
  if (swingExit) {
    return t("analysis.lines.swingExitPlan", {
      profit: swingExit[1],
      minutes: swingExit[2],
      time: swingExit[3],
      ma: swingExit[4],
      atr: swingExit[5],
    })
  }

  const prebreakoutMicrocap = line.match(
    /^Microcap gate:\s+market cap\s+\$([^ ]+)\s+and float\s+(.+)\.$/
  )
  if (prebreakoutMicrocap) {
    return t("analysis.lines.prebreakoutMicrocap", {
      cap: prebreakoutMicrocap[1],
      float: prebreakoutMicrocap[2],
    })
  }

  const prebreakoutTurnover = line.match(
    /^Turnover:\s+([\d.]+)%\s+\(target\s+([\d.]+)-([\d.]+)%\)\.$/
  )
  if (prebreakoutTurnover) {
    return t("analysis.lines.prebreakoutTurnover", {
      turnover: prebreakoutTurnover[1],
      min: prebreakoutTurnover[2],
      max: prebreakoutTurnover[3],
    })
  }

  const prebreakoutRvol = line.match(/^RVOL:\s+([\d.]+)x\s+\(avg\s+(.+)\)\.$/)
  if (prebreakoutRvol) {
    return t("analysis.lines.prebreakoutRvol", {
      rvol: prebreakoutRvol[1],
      avg: prebreakoutRvol[2],
    })
  }

  const prebreakoutClose = line.match(
    /^Close near high:\s+([\d.]+)% of range\s+\(min\s+(\d+)%\)\.$/
  )
  if (prebreakoutClose) {
    return t("analysis.lines.prebreakoutCloseNearHigh", {
      range: prebreakoutClose[1],
      min: prebreakoutClose[2],
    })
  }

  const prebreakoutRunUp = line.match(
    /^Run-up check:\s+([-+]?\d+(?:\.\d+)?%)\s+over\s+(\d+)d\s+\(max\s+\+?([\d.]+)%\)\.$/
  )
  if (prebreakoutRunUp) {
    return t("analysis.lines.prebreakoutRunUp", {
      runup: prebreakoutRunUp[1],
      lookback: prebreakoutRunUp[2],
      max: prebreakoutRunUp[3],
    })
  }

  const prebreakoutBase = line.match(
    /^Base \+ lift:\s+MA(\d+)\s+slope\s+([-\d.]+),\s+ATR%\s+([\d.]+)\s+\(<=\s+(\d+)%\)\.$/
  )
  if (prebreakoutBase) {
    return t("analysis.lines.prebreakoutBaseLift", {
      maShort: prebreakoutBase[1],
      slope: prebreakoutBase[2],
      atr: prebreakoutBase[3],
      max: prebreakoutBase[4],
    })
  }

  const prebreakoutNarrative = line.match(
    /^Narrative saturation:\s+(\d+)\s+headlines\s+\(max\s+(\d+)\)\.$/
  )
  if (prebreakoutNarrative) {
    return t("analysis.lines.prebreakoutNarrative", {
      count: Number(prebreakoutNarrative[1]),
      max: prebreakoutNarrative[2],
    })
  }

  const prebreakoutEntry = line.match(/^Entry timing: last (\d+)m before close\.$/)
  if (prebreakoutEntry) {
    return t("analysis.lines.prebreakoutEntry", { minutes: prebreakoutEntry[1] })
  }

  const prebreakoutExit = line.match(
    /^Exit plan:\s+\+([\d.]+%?) pop by (\d+)m,\s+else exit by (.+), stop ([\d.]+) ATR\.$/
  )
  if (prebreakoutExit) {
    return t("analysis.lines.prebreakoutExit", {
      profit: prebreakoutExit[1],
      minutes: prebreakoutExit[2],
      time: prebreakoutExit[3],
      atr: prebreakoutExit[4],
    })
  }

  const noteMatch = line.match(/^Note:\s+(.+)$/)
  if (noteMatch) {
    return t("analysis.lines.note", { note: translateRationaleNote(noteMatch[1], t) })
  }

  const aiMatch = line.match(/^AI note:\s+(.+)$/)
  if (aiMatch) {
    return t("analysis.lines.aiNote", { note: aiMatch[1] })
  }

  return null
}

export function localizeAnalysis(
  analysis: MarketTradeAnalysis | undefined,
  t: TFunction,
  language: string
): LocalizedAnalysis {
  if (!analysis) return {}
  if (!language.startsWith("zh")) {
    return { summary: analysis.summary, details: analysis.details }
  }
  const summary = analysis.summary ? translateSummary(analysis.summary, t) || analysis.summary : analysis.summary
  const details = analysis.details
    ? analysis.details.map((line) => translateDetail(line, t) || line)
    : analysis.details
  return { summary, details }
}

export function getAnalysisNoteKind(line?: string | null): AnalysisNoteKind | null {
  if (!line) return null
  if (line.startsWith("AI note:")) return "llm"
  if (line.startsWith("Note:")) return "rules"
  return null
}

export function findAnalysisNoteKind(details?: string[] | null): AnalysisNoteKind | null {
  if (!details || details.length === 0) return null
  for (const line of details) {
    const kind = getAnalysisNoteKind(line)
    if (kind) return kind
  }
  return null
}
