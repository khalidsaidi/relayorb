import type { MarketHotTrade } from "@/lib/types"

/**
 * Builds an AI prompt for trading advice based on trade data
 */
export function buildAiPrompt(item: MarketHotTrade) {
  const momentum = item.momentum || {}
  const signals = item.signals || {}
  const trend = item.trend || {}
  const news = item.news || {}
  
  // Calculate volatility estimate
  const volatility = momentum.change1h !== undefined && momentum.change24h !== undefined
    ? Math.abs(momentum.change24h - (momentum.change1h || 0))
    : null

  // Build search query suggestion
  const searchQuery = item.assetClass === "stock"
    ? `${item.symbol} stock news today price analysis`
    : item.assetClass === "crypto"
    ? `${item.symbol} cryptocurrency news today price analysis`
    : `${item.symbol} forex news today analysis`

  return [
    "You are a trading dashboard assistant. Analyze all provided data AND search the web for recent news and information about the asset to make accurate recommendations.",
    "",
    "IMPORTANT: Before making your recommendation, search the web for recent news, earnings reports, technical analysis, or market events about this asset. Use a web search tool or API to find breaking news, price analysis, and market sentiment.",
    "",
    "Given the trade context, FIRST search the web for recent information about this asset, THEN analyze ALL data and return JSON:",
    '{"action":"buy|hold|sell","holdMinutes":number,"stopLossPct":0.5-8,"takeProfitPct":1-15,"summary":"simple sentence","reasoning":"short reason"}',
    "",
    "Suggested web search query:",
    `"${searchQuery}"`,
    "",
    "Calculate holdMinutes (15-1440 minutes) based on:",
    `- Trend horizon: ${trend.horizon || 'n/a'} (15m=15min, 1h=60min, 24h=1440min, 7d=10080min)`,
    "- Momentum speed: Fast moves (high 1h change) = shorter holds, slow trends = longer holds",
    "- Asset class: Crypto moves faster (15-120min), Stocks slower (60-480min), Forex varies",
    "- Signal strength: Strong signals = shorter holds (capture move quickly), weak = longer",
    "- Volatility: High volatility = shorter holds, low = longer",
    "- Recent news/events: Breaking news or events may require immediate action or longer holds",
    "",
    "Rules:",
    "- Use 'hold' if signals are mixed or weak.",
    "- stopLossPct and takeProfitPct are percentages; use null if action is hold.",
    "- holdMinutes should reflect when the trade thesis expires or target should be reached",
    "- For crypto scalps: 15-60min, for swing trades: 240-1440min",
    "- Consider recent news: breaking news may require shorter holds, earnings may require longer",
    "- Keep the summary short and plain English.",
    "",
    "Trade Data:",
    `Symbol: ${item.symbol}`,
    `Asset class: ${item.assetClass}`,
    `Side hint: ${item.side || "n/a"}`,
    `Score: ${item.score ?? "n/a"} / 100`,
    `Current price: ${item.price ?? "n/a"}`,
    `Trend score: ${trend.score ?? "n/a"} (higher = stronger trend)`,
    `Trend horizon: ${trend.horizon || "n/a"} (timeframe of the trend signal)`,
    `Momentum 1h: ${momentum.change1h !== undefined ? momentum.change1h.toFixed(2) + '%' : 'n/a'}`,
    `Momentum 24h: ${momentum.change24h !== undefined ? momentum.change24h.toFixed(2) + '%' : 'n/a'}`,
    `Momentum 7d: ${momentum.change7d !== undefined ? momentum.change7d.toFixed(2) + '%' : 'n/a'}`,
    `Volatility estimate: ${volatility !== null ? volatility.toFixed(2) + '%' : 'n/a'}`,
    `Bots: ${signals.buy ?? 0} buy / ${signals.sell ?? 0} sell (${signals.total ?? 0} total)`,
    `Sentiment: ${news.sentiment !== undefined ? news.sentiment.toFixed(2) + ' (' + (news.count ?? 0) + ' headlines)' : 'n/a'}`,
    `AI summary: ${item.analysis?.summary || item.rationale || "n/a"}`,
    "",
    "Now search the web for recent information about this asset, then provide your recommendation based on both the trade data and web search results.",
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
