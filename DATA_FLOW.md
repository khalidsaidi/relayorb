# RelayOrb Data Flow & Scoring System

> ✅ **VERIFIED**: Data flow is aligned with current code execution and live Firebase data.

## Important Notes

- **Single ScoreEngine** drives hot trades, trending, and action board (no extra boosts).
- **Momentum normalization** uses rolling volatility (1m/5m range scaled by horizon) for cross-asset comparability.
- **Momentum input** is a blend of 1m/5m “now” + horizon context (15m/1h/24h/7d).
- **Signal weight** is dynamic (0.5x - 1.5x based on prediction accuracy) and decays by recency.
- **Penalties** (spread/liquidity/price/volume/sentiment) are explicit in the score breakdown.
- **Redis** holds hot price windows + snapshots; Firestore holds latest state/configs for the UI.
- **Event trigger:** market-intel publishes `new_batch` to Redis so the agent + evaluator can react immediately.
- **Durable fallback:** market-intel writes `batches/{batchId}` so services can catch up if pub/sub events are missed.

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. DATA COLLECTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Crypto (CoinGecko via gateway) → Top trending list            │
│  Price Streamer → Redis hot store (latest + snapshot window)   │
│  Price Streamer → Firestore market/prices (UI live tags)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    2. BOT SIGNAL AGGREGATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Fetch signals from all bots (Freqtrade, Market-intel)         │
│  Lookback: Last 360 minutes (6 hours)                          │
│                                                                  │
│  For each symbol:                                               │
│    - Count total signals, buy signals, sell signals            │
│    - Calculate weighted scores (by bot accuracy)               │
│    - Track signal strength (0.0 - 1.0)                         │
│    - Track recency (newer = better)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    3. NEWS SENTIMENT ANALYSIS                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Marketaux (via gateway) → Fetch news for top symbols          │
│  Analyze sentiment: -1.0 (bearish) to +1.0 (bullish)          │
│  Score: sentiment * article_count                               │
│  Cached: Updates every 30 minutes                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    4. TREND CALCULATION                         │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Uses the same ScoreEngine as hot trades                     │
│                                                                  │
│  For each asset across horizons (15m, 1h, 24h, 7d):             │
│                                                                  │
│    Momentum input = blend(1m/5m, horizon change)                │
│    Momentum strength = |momentum| / volatilityScale             │
│    Consensus = signal bias * recency factor                     │
│    Liquidity = volume rank or score (0–1)                       │
│    News = normalized sentiment (if present)                     │
│                                                                  │
│    Score = momentum + consensus + liquidity + news + universe – penalties │
│                                                                  │
│    Default weights (normalized):                                │
│      momentum: 50%, liquidity: 20%, consensus: 20%, news: 10%   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    5. HOT TRADES SCORING                        │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Same ScoreEngine as trending (single scale across assets)   │
│                                                                  │
│  Score components:                                              │
│    + Momentum (normalized by rolling volatility)                │
│    + Bot consensus (bias * recency)                             │
│    + Liquidity (volume/flow rank)                               │
│    + News sentiment (if present)                                │
│    + Universe boost (when mode = weighted_union)                │
│    – Penalties: spread, low liquidity, low price/volume,        │
│      and negative sentiment on dip profiles                     │
│                                                                  │
│  FINAL SCORE = clamp(sum, 0, 100)                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    6. AI ENRICHMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OpenAI GPT-4 → Generate explanations for top 10 hot trades    │
│  Updates every 30 minutes                                       │
│  Fallback: Use previous rationale if AI fails                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    7. FIREBASE OUTPUT                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  market/hotTrades → Top ranked trades with scores              │
│  market/trending → Trends by horizon (1h, 4h, 24h, 7d)        │
│  market/news → News sentiment scores                            │
│  market/actionBoard → Buy/sell picks by asset class            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Score Calculation Details

### ScoreEngine (hot trades + trending)

- **Momentum**: blend(1m/5m, horizon change) normalized by rolling volatility.
- **Consensus**: bot bias * recency factor, scaled by `signalWeight`.
- **Liquidity**: volume rank/score (0–1).
- **News**: normalized sentiment when present.
- **Universe**: watchlist boost when `weighted_union` is enabled.
- **Penalties**: spread, low liquidity, low price/volume, and negative sentiment on dip profiles.

Score = sum(components) + sum(penalties) → clamp 0–100.

### Signal Weight Multiplier

The `signalWeight` multiplies the consensus component only:
- Base: 1.0
- Increases with prediction accuracy (up to ~1.5)

### Bot Signal Aggregation

Signals from all bots are aggregated by symbol:

```javascript
{
  total: 5,              // Total signals
  buy: 4,                // Buy signals
  sell: 1,               // Sell signals
  weightedTotal: 4.8,    // Weighted by bot accuracy
  weightedBuy: 4.0,
  weightedSell: 0.8,
  strengthSum: 3.5,      // Sum of signal strengths
  weightedStrengthSum: 3.2,
  latestAt: Timestamp,   // Most recent signal time
  bots: Set(['freqtrade-1', 'market-intel'])
}
```

### Trend Score Calculation

Trend scoring reuses the same ScoreEngine across horizons (15m, 1h, 24h, 7d).

Weights auto-tune based on prediction accuracy every 24 hours.

## Data Freshness

- **Market Intel Job**: Runs every 5 minutes
- **News Updates**: Every 30 minutes (cached)
- **AI Explanations**: Every 30 minutes (cached)
- **Signal Lookback**: 360 minutes (6 hours)
- **Bot Signals**: Real-time (as bots generate them)

## Auto-Tuning

The system automatically adjusts weights based on prediction accuracy:

1. **Signal Weight**: Multiplies bot signal contributions (0.5x - 1.5x)
2. **Trend Weights**: Adjusts momentum/volume/signals/news ratios
3. **AI Nudging**: OpenAI can suggest weight adjustments

Auto-tune runs when:
- At least 50 signals evaluated
- 24 hours since last tune
- Accuracy horizon met (default: 24h)

## Example Score Calculation

**BTC/USDT Buy Signal:**
```
Base:                     20.0
Momentum (24h +5%):       7.5
Short Momentum (1h +2%):  4.0
Consensus (80% buy):      +24.0 (signalWeight=1.0)
Strength (0.8 avg):       16.0
Recency (30min old):      9.2
Liquidity (rank 1):       9.8
Watchlist:                0.0
Primary Asset:            +12.0
News Sentiment (+0.4):    +4.0
────────────────────────────────
TOTAL:                    106.5 → 100.0 (clamped)
```

**Confidence:** `min(weightedTotal / 5, 1.0)` = 0.96 (96%)

## Verification

All formulas and data flow have been verified against actual code execution:

1. **Score Calculation**: Tested with real Firebase data (ZKP/USDT trade)
   - ✅ Base score: 20
   - ✅ Momentum score: 40 (clamped from 85.39)
   - ✅ Short momentum: 0.39 (from 19.58% change)
   - ✅ Consensus: 24 (1.0 * 30 * 0.8 signalWeight)
   - ✅ Strength: 11.89 (0.74 * 20 * 0.8)
   - ✅ Final score: 100 (clamped from 114.8)

2. **Data Flow Order**: Verified in `deploy/market-intel/src/index.js`
   - ✅ Line 2660-2668: Data collection (parallel)
   - ✅ Line 2672-2675: Bot signal aggregation
   - ✅ Line 2727: News sentiment analysis (moved before hot trades)
   - ✅ Line 2743: Hot trades scoring (now uses signals + news sentiment)
   - ✅ Line 2728-2733: Trend calculation (uses signals + news)
   - ✅ Line 2734: Action board (hot trades + news boost)
   - ✅ Line 2797: AI enrichment
   - ✅ Line 2856-2882: Firebase output

4. **News Sentiment Integration**: ✅ Fixed and verified (2026-01-08)
   - News sentiment now included in hot trades scoring (-10 to +10 points)
   - Verified with real data: INTC trade shows news component of 4.1 points

3. **Signal Weight Calculation**: Verified dynamic adjustment
   - Current: 0.8x (accuracy: 38.2%)
   - Range: 0.5x - 1.5x (based on prediction accuracy)
