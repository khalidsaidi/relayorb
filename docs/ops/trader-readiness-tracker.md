# Trader Readiness Tracker (RelayOrb)

Goal: make the OpenBB + FinnewsHunter + StockPulse experience **usable by a trader**, not a developer.

This file defines what "100% done" means for the current scope and tracks progress.

## Scope (Current)

- UI dev server reachable from Windows + stable HMR
- OpenBB Console: quotes + history + news + fundamentals + technicals + compare + watchlist, with trader-friendly visuals
- FinnewsHunter: SEC/news feed usable (search works; tickers show up; basic sentiment + metadata)
- StockPulse: ratings + sentiment are correct; filters work; AI chat works; watchlist coverage scales beyond 20
- Cross-module: a minimal "Trader Dashboard" that ties all 3 together (same symbol context + deep links)

Out of scope (for this tracker):
- IBKR execution, ORB robot, replay, legacy scanners/bots, portfolio execution pages

## Status Legend

- `[ ]` pending
- `[~]` in progress
- `[x]` done

## 0) Dev Server / Windows + WSL Reliability

- [x] Run dev server in tmux (survives IDE restarts) via `scripts/ui-dev.sh`
- [x] Default dev port avoids Windows excluded port ranges: `5170` (Vite default `5173` often breaks on Windows+WSL)
- [x] Stable HMR websocket in Windows browser (force IPv4 HMR host `127.0.0.1`)
- [x] Windows reachability verified (PowerShell `Invoke-WebRequest http://localhost:5170/` returns 200)
- [x] Firebase sign-in guardrails: show actionable message when opened from a non-authorized origin

Evidence:
- `scripts/dev-wsl.sh`, `scripts/ui-dev.sh`
- commits: `3f2e659`, `a9a5839`

## 1) OpenBB Console (Trader-Grade)

### 1.1 Connectivity + Correct Endpoints
- [x] Base URL driven by `VITE_OPENBB_API_URL`
- [x] Use real OpenBB News endpoints (`/api/v1/news/company`, `/api/v1/news/world`)
- [x] Stop calling non-existent OpenBB endpoints (no `/api/v1/technical/*` in OpenAPI)

Evidence:
- OpenAPI: `https://relayorb.34-182-77-163.sslip.io/openbb/openapi.json`

### 1.2 Technical Indicators (No 404s, No Dashes)
- [x] RSI/MA/Bollinger computed locally from historical candles (not from `/technical/*`)
- [~] Show RSI/MA/BB values clearly in Quick Lookup + Technicals tab
- [~] Ensure "Technicals" does not render empty/dashes when history is available

### 1.3 Visuals (No Raw JSON Walls)
- [~] Quote result rendered as cards (price, bid/ask, OHLC, volume, change)
- [~] History rendered as chart (range selector affects display)
- [~] Fundamentals rendered as metrics grid + compact statements table (not JSON)
- [~] News rendered as readable list (headline, source, published time, link)
- [ ] Add "Raw JSON" toggle for debugging (off by default)
- [ ] Export CSV for statements + candles

### 1.4 Compare
- [~] Side-by-side metric table for N symbols (price, change, volume, basic valuation)
- [ ] Side-by-side charts (normalized performance % + raw price)

### 1.5 Watchlist (OpenBB-local)
- [~] Add/remove symbols (persist in localStorage)
- [ ] Watchlist view shows snapshot + deep links into tabs

## 2) FinnewsHunter (Trader-Grade)

- [~] Latest feed: show published time, source, type, headline, link
- [~] Ticker enrichment (UI fallback): derive tickers from title patterns when backend stock_codes are missing
- [ ] Ticker enrichment for SEC items (CIK -> ticker mapping via SEC `company_tickers.json` cache)
- [ ] Search reliability: common US tickers (e.g. TSLA) should return results when present
- [ ] Sentiment tag (simple first pass): positive/neutral/negative + confidence
- [ ] Relevance scoring: show why an item appears (keyword/ticker match)
- [ ] Rate-limit + freshness UI hints (crawl cadence + last crawl)

## 3) StockPulse (Trader-Grade)

- [ ] Fix US market filter so it affects **all** sections consistently (including ratings table)
- [ ] Fix RSI calculation (should not be a constant across symbols)
- [ ] AI chat: configure provider and show clear error if missing (no silent failure)
- [ ] Watchlist coverage: raise max monitored stocks (target: 100+ with paging; 500 later)
- [ ] Persist rating history snapshots (daily/15m) and show rating changes over time
- [ ] Add per-rating "why" explanation (top contributors: sentiment/technicals/news volume)

## 4) Cross-Module Workflow ("Trader Dashboard")

- [ ] One place to enter symbols and see:
  - OpenBB: price + technical snapshot
  - FinnewsHunter: latest filings/news for the same symbols
  - StockPulse: rating + sentiment for the same symbols
- [ ] Deep links: click symbol -> opens OpenBB/Finnews/StockPulse at same symbol
- [ ] Basic alerts (in-app): "new SEC filing", "rating change", "RSI threshold"

## 5) Current Completion Estimate

This is a rough tracker-driven estimate, not a claim of "production ready".

- Dev server reliability: ~100%
- OpenBB connectivity + technical endpoint correctness: ~70%
- OpenBB trader visuals: ~30%
- FinnewsHunter trader usability: ~20%
- StockPulse trader usability: ~15%
- Cross-module workflow: ~0%
