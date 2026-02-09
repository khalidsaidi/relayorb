# Trader OSS Console v10 Tracker (OpenBB + FinnewsHunter + StockPulse + Alerts)

Goal: the **Trader** page provides a coherent workflow for a US equity trader using the 3 OSS tools:

- `OpenBB` for quotes/history/fundamentals/technicals + trader visuals
- `FinnewsHunter` for SEC filings + headlines with ticker enrichment + sentiment + search usability
- `StockPulse` for sentiment/ratings at scale + rating history persistence
- `In-app alerts` (header bell): filings / rating changes / RSI thresholds (execution/portfolio/risk are paused)

Out of scope (paused):
- execution, portfolio, order management, risk engine

## 0) Dev + Deploy Hygiene

- [ ] Local dev UI is reachable from Windows via `http://localhost:<PORT>/` (no WSL-IP required)
- [ ] Vite HMR websocket is stable (no `[vite] failed to connect to websocket` spam)
- [ ] Firebase sign-in works in dev (no `auth/unauthorized-domain`)
- [ ] Prod (`https://relayorb.web.app`) shows **no generic** “Failed to fetch” on core actions

## 1) Unified Symbol Sync (Trader Page)

Expected behavior: when the user runs Trader lookup for `BBAI TSLA ...` the system makes the symbols “real” across tools:

- OpenBB: can quote/history immediately (no “watchlist required”)
- StockPulse: symbol is in monitored set so ratings/sentiment fills in
- Finnews: symbol is registered in Finnews stocks list and a US-targeted crawl is queued so per-symbol news/filings populate

Checklist:
- [ ] Trader “Run lookup” pushes symbols into StockPulse monitored list (`POST /stockpulse/api/stocks`)
- [ ] Trader “Run lookup” registers symbols in Finnews stock list (`POST /finnews/api/v1/stocks`) OR guarantees targeted crawl upserts into stocks
- [ ] Trader “Run lookup” queues Finnews targeted crawl (`POST /finnews/api/v1/stocks/{ticker}/targeted-crawl`)
- [ ] Trader “Run lookup” shows deterministic UX when Finnews is still crawling (“queued, refresh in 30-60s”)
- [ ] No Finnews targeted crawl failures due to CN-only providers (no `BochaAI API Key 未配置` in US mode)

## 2) OpenBB: Trader Visuals Completion

- [ ] No raw JSON as the primary UI output on Quick Lookup (cards/tables/charts first; raw JSON optional)
- [ ] Charts never render at width/height `-1` (no Recharts warnings)
- [ ] Exports: JSON and CSV for quotes/history/compare, with clear filenames
- [ ] Technicals never show empty dashes when history exists (compute from candles when provider lacks dedicated endpoints)
- [ ] Compare: visual + table side-by-side, usable on laptop widths (no overflow/clipping)
- [ ] Watchlist: add/remove works; watchlist snapshot refresh is fast; can import/export tickers
- [ ] Freshness hints: show data age and provider; warn on rate-limit/stale

## 3) FinnewsHunter: US Trader Defaults + Trust

- [ ] CIK -> ticker enrichment (items without tickers get mapped via SEC CIK map)
- [ ] Sentiment tagging (headline/body -> label + score)
- [ ] Search reliability UX: clear empty states (“no matches”, “crawl queued”, “rate limited”)
- [ ] Relevance scoring: show “why this matched” (matched ticker, matched keyword, matched CIK/company name)
- [ ] Freshness + rate-limit hints: show last crawl time, last rate-limit event, and “data may be stale” badge
- [ ] US targeted crawl works without CN providers (SEC filings + US RSS), and writes results with `stock_codes=[TICKER]`

## 4) StockPulse: Scale + History Persistence

- [ ] Watchlist/monitored symbols scale beyond 20 (bulk add + import OpenBB watchlist)
- [ ] Market filter applies consistently across all tables/cards (US filter hides non-US tickers everywhere)
- [ ] Ratings persistence: historical ratings stored per ticker (timestamped) and visible in UI
- [ ] RSI looks real (no uniform placeholder across unrelated tickers)

## 5) Cross-Module: In-App Alerts (Basic)

Alerts are **informational only** (no trading actions).

- [ ] Filing alerts: new SEC filing for a watchlist ticker (Finnews -> alerts bell)
- [ ] Rating-change alerts: rating flips for a watchlist ticker (StockPulse -> alerts bell)
- [ ] RSI threshold alerts: oversold/overbought crossing for a watchlist ticker (StockPulse RSI -> alerts bell)
- [ ] Polling cadence is safe (no provider hammering) and shows last poll time + errors

