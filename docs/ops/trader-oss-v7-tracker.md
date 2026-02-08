# Trader OSS Console v7 Tracker (OpenBB + FinnewsHunter + StockPulse)

Scope: trader research console only. Execution/portfolio/risk/broker/ORB is **paused**.

## Baseline (Must Stay True)

- [x] Dev UI reachable from Windows
  - Expected: use `http://localhost:5170` (NOT `127.0.0.1`)
  - Script: `bash scripts/ui-dev.sh status`
- [x] Signed-in E2E pass on prod
  - Script: `node scripts/verify-oss-console.mjs --base https://relayorb.web.app --email khalidsaidi66@gmail.com`
  - Artifact: `tmp.verify-oss-console.ok.png`

## OpenBB (Trader Visuals)

- [x] Quick lookup shows readable cards (not raw JSON)
  - Quote card: price, bid/ask, high/low, volume, as-of + delayed hint.
  - Fundamentals snapshot + statements tables.
  - Technicals computed from history (RSI/MA/BB) and never blank when candles exist.
- [x] Charts are stable (no Recharts width/height warnings)
- [x] Exports
  - CSV export for candles + technicals
  - JSON export for lookup / compare / watchlist / explorer / custom
- [x] News panel is not broken
  - Replace OpenBB “company news” (often 404) with Finnews headlines.

## FinnewsHunter (Trader Usability)

- [x] CIK → ticker enrichment (SEC filings show tickers even when backend doesn’t)
  - Asset: `/sec-cik-map.v1.json` is loaded and cached in `localStorage.sec_cik_map_v1`
- [x] Sentiment tagging
  - Uses backend `sentiment_score` when present; deterministic keyword baseline otherwise.
- [x] Search reliability UX
  - Uses v2 fetch (`/api/v1/news/v2/fetch`) for keyword search
  - Empty state explains “crawl + retry” and shows last crawl freshness.
- [x] Relevance scoring
  - Search results sorted by match score; “why matched” shown in details.
- [x] Freshness/rate-limit hints
  - Stale + rate limit callouts visible in UI (from recent tasks).

## StockPulse (Scaling + Persistence)

- [x] Watchlist scales beyond 20 tickers
  - Bulk add UI supports pasting many symbols
  - Missing ratings are explicit + can be computed on-demand
- [x] Rating history persistence is hardened
  - `/api/ai/rating-history/:ticker` works and UI renders trend table
- [x] Currency clarity
  - Prices show currency code (USD/INR) and currency symbol
- [x] AI chat is usable
  - Either configured provider works, or the UI clearly instructs how to configure it (no silent failure).

## Cross-Module In-App Alerts

- [x] Alerts exist for: SEC filing / rating change / RSI threshold
  - Driven by OpenBB watchlist + per-ticker prefs
- [x] Mute controls
  - Mute 1h, mute today, unmute (mutes toast popups, still records alerts)
- [x] Polling is stable
  - Poll interval configurable; manual Poll works without errors

## Closure

- [x] `npm run build` passes locally
- [x] No remaining diffs (`git status --porcelain` is empty)
- [x] Commit + push
