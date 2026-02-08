# OSS Trader Console V3 Tracker (OpenBB + Finnews + StockPulse + Alerts)

This is the **single source of truth** for “100% done” on the OSS trader console.

Scope:
- OpenBB (quotes, candles, fundamentals, technicals, compare, watchlist, exports, polish)
- FinnewsHunter (SEC/news feed, CIK->ticker enrichment, sentiment, search UX, relevance, freshness/rate-limit hints)
- StockPulse (watchlist scale, market filtering, rating history persistence)
- Cross-module **in-app alerts** (filing / rating-change / RSI threshold)

Explicitly paused (not counted): execution, portfolio, broker, risk.

## Legend
- Implemented: code exists in repo
- Verified: confirmed in a real browser session on `relayorb.web.app` (or on dev UI for dev-only items)

`[ ]` pending, `[x]` done

## 0) 100% Definition
100% means every item in sections 1-5 is `[x]` Implemented and `[x]` Verified.

---

## 1) Reliability / DX (No Mystery Failures)

- Implemented: [x] Every UI fetch error shows: service + endpoint + status + short excerpt + hint.
- Verified: [ ] No generic “Failed to fetch” appears on OpenBB/Finnews/StockPulse core actions.

- Implemented: [x] Each module page shows resolved base URL and has a `Health` check.
- Verified: [ ] Health checks pass and base URLs match the VM (`https://relayorb.<vm>.sslip.io/...`).

- Implemented: [x] Local dev server is restartable via script and reachable from Windows **via** `http://localhost:<port>`.
- Verified: [x] Windows can load dev UI via `http://localhost:5170/` (WSL localhost forwarding OK).

- Implemented: [x] Local dev auth guidance is explicit (avoid `127.0.0.1`/WSL IP for Firebase popup auth).
- Verified: [ ] No `auth/unauthorized-domain` for the supported local URL (`http://localhost:<port>`).

---

## 2) OpenBB (Trader Visuals)

- Implemented: [x] Quote renders readable card + provider + as-of/delay disclosure.
- Verified: [ ] `AAPL` quick lookup shows numeric quote and as-of line.

- Implemented: [x] Candles chart renders without Recharts width/height warnings (container sizing guarded).
- Verified: [ ] No `width(-1)/height(-1)` warnings in console during `AAPL` history render.

- Implemented: [x] Technicals (RSI/MA/BB) computed locally from candles and never blank when candles exist.
- Verified: [ ] For `AAPL` + range `1M`, RSI/MA/BB show numbers (not `—`).

- Implemented: [x] Fundamentals render as metrics + compact statement tables (not raw JSON).
- Verified: [ ] Fundamentals fetch shows readable metrics/tables for `AAPL`.

- Implemented: [x] Company news renders as readable cards/list (not raw JSON).
- Verified: [ ] News fetch returns and renders items for `AAPL`.

- Implemented: [x] Compare renders chart + side-by-side metrics.
- Verified: [ ] Compare `AAPL,MSFT` works in both `%` and `price` modes.

- Implemented: [x] Watchlist persists + supports snapshot refresh.
- Verified: [ ] Watchlist snapshot refresh works for 5+ symbols.

- Implemented: [x] CSV exports exist (candles, technicals, statements).
- Verified: [ ] CSV export downloads valid CSV (opens cleanly in Excel) for candles + technicals.

---

## 3) FinnewsHunter (US Trader Defaults)

- Implemented: [x] CIK->ticker enrichment (SEC map + heuristic extraction) so SEC rows aren’t `—`.
- Verified: [ ] Latest table shows tickers for recent SEC filings.

- Implemented: [x] Sentiment tagging always present; UI labels baseline vs provider (if any).
- Verified: [ ] Latest + Search show sentiment pill with tooltip explaining source.

- Implemented: [x] Search reliability UX: “Run crawl” guidance + stale/429 hints + good empty-state.
- Verified: [ ] Search `TSLA` behaves correctly (results or actionable empty state w/ last crawl).

- Implemented: [x] Relevance scoring: numeric score + “why matched” reasons (ticker/keyword/CIK).
- Verified: [ ] Search results show score and reasons on matches.

- Implemented: [x] Freshness / rate-limit hints: last crawl time + cadence estimate + 429 guidance.
- Verified: [ ] Hints render and update after running a crawl.

---

## 4) StockPulse (Scale + Trust)

- Implemented: [x] Bulk import supports 50+ tickers and import from OpenBB watchlist.
- Verified: [ ] Bulk import 50 tickers completes and ratings populate.

- Implemented: [x] Market filter consistently applies to ratings table (US removes `.NS/.BO`).
- Verified: [ ] With market `US`, ratings table contains no `.NS/.BO` tickers.

- Implemented: [x] Rating history persistence:
  - endpoint: `/api/ai/rating-history/:ticker`
  - stored in sqlite `/data/stock_news.db`
  - UI shows history chart + last points
- Verified: [ ] History accumulates and persists across service restart.

---

## 5) Cross-Module In-App Alerts

- Implemented: [x] Alerts bell + settings UI exist in header.
- Verified: [ ] Bell opens, settings persist, polling works.

- Implemented: [x] Filing alerts for watchlist tickers (Finnews -> alerts).
- Verified: [ ] After a crawl, at least one filing alert appears for a watched ticker.

- Implemented: [x] Rating-change alerts for watchlist tickers (StockPulse -> alerts).
- Verified: [ ] A rating change produces an alert (can force by watching for changes or toggling thresholds).

- Implemented: [x] RSI threshold alerts (overbought/oversold) using StockPulse RSI.
- Verified: [ ] A threshold crossing creates an alert (can force by setting threshold around current RSI).

---

## 6) Notes / Known Limits (Not Bugs)

- OpenBB providers are intentionally constrained to configured ones (ex: `yfinance`, optional `intrinio` when key exists).
- Popup auth requires an authorized domain: local dev should use `http://localhost:<port>` (not WSL IP / `127.0.0.1`).
