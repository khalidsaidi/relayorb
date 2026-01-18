import type { MarketHotTrade } from "@/lib/types"
import { localizeAnalysis } from "@/lib/analysis-localize"
import i18n from "@/i18n"

/**
 * Builds an AI prompt for trading advice based on trade data
 */
export function buildAiPrompt(item: MarketHotTrade) {
  const t = i18n.t.bind(i18n)
  const naPrompt = t("aiPrompt.na")
  const momentum = item.momentum || {}
  const signals = item.signals || {}
  const trend = item.trend || {}
  const news = item.news || {}
  const localizedAnalysis = localizeAnalysis(item.analysis, t, i18n.language)
  
  // Calculate volatility estimate
  const volatility = momentum.change1h !== undefined && momentum.change24h !== undefined
    ? Math.abs(momentum.change24h - (momentum.change1h || 0))
    : null

  // Build search query suggestion
  const searchQuery = item.assetClass === "stock"
    ? t("aiPrompt.searchQuery.stock", { symbol: item.symbol ?? naPrompt })
    : item.assetClass === "crypto"
    ? t("aiPrompt.searchQuery.crypto", { symbol: item.symbol ?? naPrompt })
    : t("aiPrompt.searchQuery.forex", { symbol: item.symbol ?? naPrompt })
  const assetLabelMap: Record<string, string> = {
    stock: t("assets.stock"),
    crypto: t("assets.crypto"),
    forex: t("assets.forex"),
  }
  const assetLabel = assetLabelMap[item.assetClass] || item.assetClass
  const sideLabel = item.side ? t(`trade.side.${item.side}`) : naPrompt
  const horizonLabelMap: Record<string, string> = {
    "15m": t("analysis.time.m15"),
    "1h": t("analysis.time.h1"),
    "24h": t("analysis.time.h24"),
    "7d": t("analysis.time.d7"),
  }
  const horizonLabel = trend.horizon ? horizonLabelMap[trend.horizon] || trend.horizon : naPrompt
  const sentimentLine =
    news.sentiment !== undefined
      ? t("aiPrompt.sentimentWithCount", {
          sentiment: news.sentiment.toFixed(2),
          count: news.count ?? 0,
        })
      : naPrompt
  const aiSummary = localizedAnalysis.summary || item.rationale || naPrompt

  return [
    t("aiPrompt.intro"),
    "",
    t("aiPrompt.important"),
    "",
    t("aiPrompt.instructions"),
    t("aiPrompt.jsonSchema"),
    "",
    t("aiPrompt.searchQueryLabel"),
    `"${searchQuery}"`,
    "",
    t("aiPrompt.holdIntro"),
    t("aiPrompt.holdTrend", { horizon: horizonLabel, legend: t("aiPrompt.horizonLegend") }),
    t("aiPrompt.holdMomentum"),
    t("aiPrompt.holdAssetClass"),
    t("aiPrompt.holdSignals"),
    t("aiPrompt.holdVolatility"),
    t("aiPrompt.holdNews"),
    "",
    t("aiPrompt.rulesTitle"),
    t("aiPrompt.ruleHold"),
    t("aiPrompt.ruleStopTake"),
    t("aiPrompt.ruleHoldMinutes"),
    t("aiPrompt.ruleCryptoScalp"),
    t("aiPrompt.ruleNews"),
    t("aiPrompt.ruleSummary"),
    "",
    t("aiPrompt.tradeDataTitle"),
    t("aiPrompt.tradeSymbol", { symbol: item.symbol ?? naPrompt }),
    t("aiPrompt.tradeAssetClass", { assetClass: assetLabel }),
    t("aiPrompt.tradeSideHint", { side: sideLabel }),
    t("aiPrompt.tradeScore", { score: item.score ?? naPrompt }),
    t("aiPrompt.tradeCurrentPrice", { price: item.price ?? naPrompt }),
    t("aiPrompt.tradeTrendScore", {
      score: trend.score ?? naPrompt,
      note: t("aiPrompt.trendStrengthNote"),
    }),
    t("aiPrompt.tradeTrendHorizon", {
      horizon: horizonLabel,
      note: t("aiPrompt.trendHorizonNote"),
    }),
    t("aiPrompt.tradeMomentum1h", {
      value: momentum.change1h !== undefined ? `${momentum.change1h.toFixed(2)}%` : naPrompt,
    }),
    t("aiPrompt.tradeMomentum24h", {
      value: momentum.change24h !== undefined ? `${momentum.change24h.toFixed(2)}%` : naPrompt,
    }),
    t("aiPrompt.tradeMomentum7d", {
      value: momentum.change7d !== undefined ? `${momentum.change7d.toFixed(2)}%` : naPrompt,
    }),
    t("aiPrompt.tradeVolatility", {
      value: volatility !== null ? `${volatility.toFixed(2)}%` : naPrompt,
    }),
    t("aiPrompt.tradeBots", {
      buy: signals.buy ?? 0,
      sell: signals.sell ?? 0,
      total: signals.total ?? 0,
    }),
    t("aiPrompt.tradeSentiment", { sentiment: sentimentLine }),
    t("aiPrompt.tradeAiSummary", { summary: aiSummary }),
    "",
    t("aiPrompt.closing"),
  ].join("\n")
}

/**
 * Copies the AI prompt to clipboard
 */
export async function copyAiPrompt(item: MarketHotTrade): Promise<boolean> {
  try {
    const prompt = buildAiPrompt(item)
    await navigator.clipboard.writeText(prompt)
    return true
  } catch {
    return false
  }
}
