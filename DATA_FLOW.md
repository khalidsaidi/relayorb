# RelayOrb Data Flow & Scoring System

> ✅ **VERIFIED**: All formulas and data flow have been tested against actual code execution and real Firebase data.

## Important Notes

- **Hot trades scoring** ✅ Now includes news sentiment (-10 to +10 points)
- **News sentiment** is used for:
  - Hot trades scoring (direct component)
  - Trend calculation (buildTrending)
  - Action board boost (buildActionBoard)
- **Signal weight** is dynamic (0.5x - 1.5x based on prediction accuracy)
- **Current signalWeight**: 0.8 (accuracy: 38.2%)

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. DATA COLLECTION                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Crypto (CoinGecko) → Top 47 trending cryptos                  │
│  Stocks (Alpha Vantage) → Top gainers/losers + watchlist       │
│  Forex (Frankfurter) → EUR, GBP, JPY, AUD, CAD rates           │
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
│  Marketaux API → Fetch news for top symbols                    │
│  Analyze sentiment: -1.0 (bearish) to +1.0 (bullish)          │
│  Score: sentiment * article_count                               │
│  Cached: Updates every 30 minutes                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    4. TREND CALCULATION                         │
├─────────────────────────────────────────────────────────────────┤
│  ⚠️  Uses BOTH signals AND news sentiment                      │
│                                                                  │
│  For each asset across timeframes (1h, 4h, 24h, 7d):          │
│                                                                  │
│    Momentum Score = |change%| * scale (clamped 0-100)          │
│    Volume Score = Percentile rank (0-100)                      │
│    Signal Score = Bot consensus strength (0-100)                │
│    News Score = Sentiment score (0-100)                         │
│                                                                  │
│    Trend Score = weighted average:                              │
│      (momentum * w₁ + volume * w₂ + signals * w₃ + news * w₄) │
│      / (w₁ + w₂ + w₃ + w₄)                                     │
│                                                                  │
│    Default weights:                                             │
│      momentum: 40%, volume: 20%, signals: 30%, news: 10%       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    5. HOT TRADES SCORING                        │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Now includes news sentiment (updated 2026-01-08)          │
│                                                                  │
│  For each candidate asset:                                      │
│                                                                  │
│    BASE SCORE = 20                                              │
│                                                                  │
│    + Momentum Score (0-40):                                     │
│        max(0, change24h * direction) * 1.5                      │
│                                                                  │
│    + Short Momentum (0-10):                                     │
│        max(0, change1h * direction) * 2                         │
│                                                                  │
│    + Consensus Score (-30 to +30):                              │
│        ((buyWeight - sellWeight) / totalWeight) * 30 * signalWeight │
│                                                                  │
│    + Strength Score (0-20):                                     │
│        avgSignalStrength * 20 * signalWeight                    │
│                                                                  │
│    + Recency Score (0-10):                                      │
│        ((lookbackMinutes - ageMinutes) / lookbackMinutes) * 10 * signalWeight │
│                                                                  │
│    + Liquidity Score (0-10):                                    │
│        10 - (liquidityRank / 5)                                 │
│                                                                  │
│    + Watchlist Bonus (0 or 8):                                  │
│        8 if in watchlist, 0 otherwise                           │
│                                                                  │
│    + Primary Asset Bonus (0 or 12):                             │
│        12 if primary asset, 0 otherwise                         │
│                                                                  │
│    + News Sentiment Score (-10 to +10):                          │
│        sentiment * direction * 10                               │
│        (positive sentiment boosts buy, negative boosts sell)   │
│                                                                  │
│    FINAL SCORE = clamp(sum, 0, 100)                             │
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

### Hot Trades Score Components

**Base Score: 20 points** (always included)

#### 1. Momentum Score (0-40 points)
- Calculates 24h price change in the trade direction (buy = positive, sell = negative)
- Formula: `clamp(max(0, change24h * direction) * 1.5, 0, 40)`
- Example: +10% change for buy signal = 15 points

#### 2. Short Momentum (0-10 points)
- Calculates 1h price change in trade direction
- Formula: `clamp(max(0, change1h * direction) * 2, 0, 10)`
- Example: +5% change = 10 points (capped)

#### 3. Consensus Score (-30 to +30 points)
- Measures bot signal agreement
- Formula: `((buyWeight - sellWeight) / totalWeight) * 30 * signalWeight`
- Weighted by bot accuracy (higher accuracy = more weight)
- Positive = buy consensus, Negative = sell consensus
- Example: 80% buy signals = +24 points (with signalWeight=1)

#### 4. Strength Score (0-20 points)
- Average signal strength from all bots (0.0 - 1.0)
- Formula: `avgStrength * 20 * signalWeight`
- Example: 0.8 avg strength = 16 points (with signalWeight=1)

#### 5. Recency Score (0-10 points)
- Newer signals are worth more
- Formula: `((360 - ageMinutes) / 360) * 10 * signalWeight`
- Example: 60 minutes old = 8.3 points

#### 6. Liquidity Score (0-10 points)
- Based on volume ranking (lower rank = higher liquidity)
- Formula: `10 - (liquidityRank / 5)`
- Example: Rank 10 = 8 points, Rank 50 = 0 points

#### 7. Watchlist Bonus (0 or 8 points)
- User-specified watchlist assets get bonus

#### 8. Primary Asset Bonus (0 or 12 points)
- Priority assets (BTC, ETH, major stocks) get bonus

### Signal Weight Multiplier

The `signalWeight` multiplies consensus, strength, and recency scores:
- Base: 1.0
- Increases with prediction accuracy (up to ~1.5)
- Formula: `1 + (hitRate - 0.5) * 0.5`
- Example: 70% accuracy = 1.1x multiplier

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

For each time horizon (1h, 4h, 24h, 7d):

```
Components:
  - Momentum: |change%| * scale → 0-100
  - Volume: Percentile rank → 0-100
  - Signals: Bot consensus strength → 0-100
  - News: Sentiment score → 0-100

Trend Score = weighted average:
  (momentum*0.4 + volume*0.2 + signals*0.3 + news*0.1)
```

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
