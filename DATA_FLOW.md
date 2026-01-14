# RelayOrb Data Flow & Scoring System

> ✅ **VERIFIED**: Data flow is aligned with current code execution and live Firebase data.
> 🔄 **Updated 2026-01-13**: Enhanced bot integration, improved signal weights, multi-indicator strategies.

## Important Notes

- **Single ScoreEngine** drives hot trades, trending, and action board (no extra boosts).
- **Momentum normalization** uses rolling volatility (1m/5m range scaled by horizon) for cross-asset comparability.
- **Momentum input** is a blend of 1m/5m "now" + horizon context (15m/1h/24h/7d).
- **Signal weight** is dynamic (0.5x - 1.5x based on prediction accuracy) and decays by recency.
- **Bot consensus weight increased** to 28% (from 20%) for stronger signal influence.
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
│  FMP (via market-data-gateway) → Stock/Forex quotes + candles  │
│  Price Streamer → Redis hot store (latest + snapshot window)   │
│  Price Streamer → Firestore market/prices (UI live tags)       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    2. BOT SIGNAL AGGREGATION                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Fetch signals from all bots (Freqtrade, Backtrader, OANDA)   │
│  Signal limit: 800 (increased from 200)                        │
│  Lookback: Last 360 minutes (6 hours)                          │
│                                                                  │
│  For each symbol:                                               │
│    - Count total signals, buy signals, sell signals            │
│    - Calculate weighted scores (by bot accuracy)               │
│    - Track signal strength (0.0 - 1.0)                         │
│    - Track recency (newer = better, exponential decay)         │
│                                                                  │
│  Bot adapters provide signals via:                             │
│    - Freqtrade: logs, open trades, dataframe analysis          │
│    - Backtrader: multi-indicator strategy (RSI, MACD, BB, etc)│
│    - Active scan commands dispatched for top candidates        │
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
│    Score = momentum + consensus + liquidity + news – penalties  │
│                                                                  │
│    Default weights (asset-class tuned):                         │
│      Stock:  momentum 42%, consensus 28%, liquidity 21%, news 9%│
│      Crypto: momentum 48%, consensus 28%, liquidity 15%, news 9%│
│      Forex:  momentum 44%, consensus 27%, liquidity 18%, news 11%│
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
│    + Bot consensus (bias * recency) - 28% weight               │
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
│                    6. BOT SCAN DISPATCH                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Priority-based symbol selection for bot analysis:             │
│    - High momentum + low signal coverage = high priority        │
│    - Top 30 symbols per asset class dispatched                 │
│    - Max 25 symbols per bot command                             │
│                                                                  │
│  Scan commands → bots/{botId}/commands (status: queued)        │
│  Agent picks up commands → triggers bot analysis               │
│  Results written → bots/{botId}/signals                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    7. AI ENRICHMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OpenAI GPT-4 → Generate explanations for top 10 hot trades    │
│  Updates every 30 minutes                                       │
│  Fallback: Use previous rationale if AI fails                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    8. FIREBASE OUTPUT                           │
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
- **Consensus**: bot bias * recency factor, scaled by `signalWeight`. **Now 28% of total score.**
- **Liquidity**: volume rank/score (0–1).
- **News**: normalized sentiment when present.
- **Universe**: watchlist boost when `weighted_union` is enabled.
- **Penalties**: spread, low liquidity, low price/volume, and negative sentiment on dip profiles.

Score = sum(components) + sum(penalties) → clamp 0–100.

### Asset-Class Specific Weights

| Component | Stock | Crypto | Forex |
|-----------|-------|--------|-------|
| Momentum | 42% | 48% | 44% |
| Consensus (Bots) | 28% | 28% | 27% |
| Liquidity | 21% | 15% | 18% |
| News | 9% | 9% | 11% |

### Signal Weight Multiplier

The `signalWeight` multiplies the consensus component only:
- Base: 1.0
- Range: 0.8x - 1.25x (based on overall prediction accuracy)
- Calculated from `analytics/signalPerformance` hit rate

### Bot Weight Multiplier

Individual bot signals are weighted by their historical accuracy:
- Base: 1.0
- Range: 0.5x - 1.5x (based on per-bot hit rate)
- Minimum 3 signals required before weighting applies

### Bot Signal Aggregation

Signals from all bots are aggregated by symbol (limit: 800 signals):

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
  recentCount: 3,        // Signals in last 30 minutes
  recentWeight: 2.8,     // Recent weighted sum
  latestAt: Timestamp,   // Most recent signal time
  bots: Set(['freqtrade-1', 'backtrader-stocks', 'market-intel'])
}
```

### Trend Score Calculation

Trend scoring reuses the same ScoreEngine across horizons (15m, 1h, 24h, 7d).

Weights auto-tune based on prediction accuracy every 24 hours.

## Bot Integration

### Backtrader (Stocks, Forex)

Multi-indicator strategy combining:
- **RSI** (14 period): Oversold < 30, Overbought > 70
- **MACD** (12/26/9): Trend following + crossover detection
- **Bollinger Bands** (20, 2σ): Mean reversion signals
- **Stochastic** (14, 3): Momentum oscillator
- **SMA Crossover** (10/50): Trend confirmation
- **Volume Analysis**: Confirmation boost when volume > 1.5x average

Signal strength is calculated based on indicator confluence (3+ agreeing = high confidence).

Asset-class specific parameters:
- **Crypto**: Faster periods, wider bands for volatility
- **Forex**: Tighter RSI thresholds, longer signal gaps
- **Stock**: Balanced default parameters

### Freqtrade (Crypto)

Signals extracted from:
1. **Log analysis**: Trade entry/exit messages
2. **Open trades**: Active positions as buy signals
3. **Dataframe analysis**: Strategy indicators (enter_long/exit_long columns)

Active scanning via `/dataframe` endpoint when available.

### Agent Orchestration

1. Market-intel dispatches scan commands to eligible bots
2. Agent polls `bots/{botId}/commands` for queued commands
3. Agent triggers bot analysis with symbol list
4. Adaptive wait times based on symbol count and asset class
5. Exponential backoff retry for signal collection
6. Results written to `bots/{botId}/signals`

## Data Freshness

- **Market Intel Job**: Runs every 5 minutes
- **News Updates**: Every 30 minutes (cached)
- **AI Explanations**: Every 30 minutes (cached)
- **Signal Lookback**: 360 minutes (6 hours)
- **Signal Fetch Limit**: 800 signals (increased from 200)
- **Bot Signals**: Real-time (as bots generate them)
- **FMP Data**: 15 second cache (quotes), 60 second cache (candles)

## Auto-Tuning

The system automatically adjusts weights based on prediction accuracy:

1. **Signal Weight**: Multiplies bot signal contributions (0.8x - 1.25x)
2. **Bot Weight**: Per-bot multiplier based on individual accuracy (0.5x - 1.5x)
3. **Trend Weights**: Adjusts momentum/volume/signals/news ratios
4. **AI Nudging**: OpenAI can suggest weight adjustments

Auto-tune runs when:
- At least 50 signals evaluated
- 24 hours since last tune
- Accuracy horizon met (default: 24h)

## Example Score Calculation

**BTC/USDT Buy Signal (Crypto):**
```
Momentum (48% weight):
  - 5m blend: +3.2%
  - Volatility scale: 2.1%
  - Momentum ratio: 1.52 → strength 0.76
  - Score: 0.76 × 48 = 36.5

Consensus (28% weight):
  - Signals: 5 buy, 1 sell
  - Weighted bias: 0.67 × signalWeight(0.95)
  - Recency factor: 0.85 (3 signals in last 30m)
  - Score: 0.67 × 0.95 × 0.85 × 28 = 15.2

Liquidity (15% weight):
  - Volume rank: 3 of 50 → ratio 0.94
  - Score: 0.94 × 15 = 14.1

News (9% weight):
  - Sentiment: +0.4 (bullish)
  - Score: 0.7 × 9 = 6.3

Penalties:
  - Spread: -1.2 (0.08% spread)
  - None other

────────────────────────────────
RAW TOTAL: 70.9
FINAL SCORE: 70.9 (no clamping needed)
CONFIDENCE: 0.85 (based on signal weight)
```

## Verification

All formulas and data flow have been verified against actual code execution:

1. **Score Weights**: Updated 2026-01-13
   - ✅ Consensus increased from 20% to 28%
   - ✅ Asset-class specific tuning implemented
   - ✅ Signal limit increased from 200 to 800

2. **Bot Integration**: Enhanced 2026-01-13
   - ✅ Backtrader: Multi-indicator strategy (RSI, MACD, BB, Stoch, SMA, Volume)
   - ✅ Freqtrade: Active scanning via dataframe analysis
   - ✅ Agent: Improved retry logic with exponential backoff
   - ✅ Priority-based scan dispatch (high momentum + low signals = priority)

3. **Signal Weight Calculation**: Verified dynamic adjustment
   - Range: 0.8x - 1.25x (based on prediction accuracy)
   - Per-bot weights: 0.5x - 1.5x

4. **News Sentiment Integration**: ✅ Fixed and verified (2026-01-08)
   - News sentiment now included in hot trades scoring (-10 to +10 points)
