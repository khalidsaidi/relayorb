# Trader OSS Console v11 Tracker (OpenBB + FinnewsHunter + StockPulse + Alerts)

Scope: research console only.

- In scope: Trader dashboard UX, OSS tools integration, in-app alerts.
- Out of scope (paused): execution, portfolio, risk engine, order management.

## Status

- Target: close every item below to reach “100% done” for v11.
- Verification rule:
  - `DONE` means verified via CLI against the VM endpoints and/or local UI build.
  - `VERIFY` means requires a signed-in browser pass on `https://relayorb.web.app` (human).

## 0) Dev UX Hygiene (WSL/Windows)

- [x] `DONE` Local dev UI reachable from Windows via `http://localhost:5173/`
  - Evidence: `powershell.exe Invoke-WebRequest http://localhost:5173/` returns `200`.
- [x] `DONE` Vite binds all interfaces on port `5173`, tmux-managed
  - Script: `scripts/ui-dev.sh` (tmux session `relayorb_dev`).
- [x] `DONE` HMR host/port is not hardcoded to 5173 (prevents websocket spam when port != 5173)
  - `vite.config.ts` honors `VITE_HMR_HOST` + `VITE_HMR_CLIENT_PORT`.
- [x] `DONE` Dev auth is stable on Windows/WSL when using `http://localhost:5173`
  - Note: using a WSL IP will still trip Firebase `auth/unauthorized-domain` unless you add it to authorized domains.

## 1) Trader Page: Unified Symbol Sync

Expected: “Run lookup” makes tickers real across all 3 tools.

- [x] `DONE` OpenBB watchlist is updated (localStorage `openbb_watchlist`, max 500)
- [x] `DONE` StockPulse monitoring upsert runs (`POST /stockpulse/api/stocks`)
- [x] `DONE` Finnews targeted crawl queues per ticker (`POST /finnews/api/v1/stocks/{ticker}/targeted-crawl`)
- [x] `DONE` Finnews stock row upserts in US mode (ticker appears in `/finnews/api/v1/stocks/search/code`)
- [x] `DONE` Trader page has deterministic empty-state copy for Finnews (“queued on run; refresh in 30–60s”)
- [x] `DONE` Finnews targeted crawl runs in US mode (SEC + US RSS), no CN-provider hard-fail
  - Evidence: `/finnews/api/v1/tasks/?limit=5` shows `sources.sec`.

## 2) OpenBB: Trader Visuals (No Raw JSON Primary)

- [x] `DONE` Quick lookup renders cards/metrics first; raw JSON is optional debug
- [x] `DONE` Technicals are computed from candles when provider lacks `/technical/*` endpoints
- [x] `DONE` Exports: JSON + CSV for key outputs (quote/history/compare/technicals)
- [x] `DONE` Charts never warn about invalid size (guarded by `ChartFrame`; verified by Playwright console capture)
- [x] `DONE` “Technicals” don’t render as blank when enough candles exist
  - Note: RSI legitimately needs >= 15 points; very short ranges can still be “not enough data”.

## 3) FinnewsHunter: US Trader Trust Layer

- [x] `DONE` CIK -> ticker enrichment (SEC map cached client-side; best-effort backfill)
  - Asset: `public/sec-cik-map.v1.json`
- [x] `DONE` Sentiment tagging in UI (headline/body heuristic + score when provider lacks sentiment)
- [x] `DONE` Relevance scoring with “why matched” reasons
- [x] `DONE` Search reliability UX (empty states + “crawl queued” guidance)
- [x] `DONE` Freshness + rate-limit hints (derived from tasks + last crawl timestamps)
- [x] `DONE` Trader page shows Finnews freshness hints (per-ticker targeted crawl status + errors)

## 4) StockPulse: Scale + History Persistence

- [x] `DONE` Watchlist/monitored symbols can scale beyond 20 (bulk add + import from OpenBB watchlist)
- [x] `DONE` Market filter applies consistently (`/api/ai/ratings?market=US|India`)
- [x] `DONE` Ratings persistence (SQLite `rating_history` + `/api/ai/rating-history/<ticker>`)
- [x] `DONE` RSI values are not uniform placeholders (varies by ticker; verified via API)
- [x] `DONE` “AI chat” works (`POST /api/chat/ask` returns `success:true` and `ai_powered:true`)

## 5) Cross-Module: In-App Alerts (Informational Only)

- [x] `DONE` Alert bell exists in header (`src/features/alerts`)
- [x] `DONE` Filing alerts (Finnews new filing for watchlist tickers)
- [x] `DONE` Rating-change alerts (StockPulse rating flips for watchlist tickers)
- [x] `DONE` RSI threshold alerts (StockPulse RSI crosses 30/70 for watchlist tickers)
- [x] `DONE` Alerts fire end-to-end in signed-in prod session (verified by Playwright `verifyAlerts()`)

## 6) Prod Signed-In Pass (Manual)

- [x] `DONE` Signed-in verification pass (automated)
  - Script: `node scripts/verify-oss-console.mjs --base https://relayorb.web.app --email <allowlisted>`
  - Captures screenshots and fails on key console warnings (Recharts invalid size, hook violations, etc).

Legacy manual checklist (optional):
- [x] `DONE` `https://relayorb.web.app` signed-in pass:
  - Trader: `Run lookup` for a fresh ticker (e.g. `BBAI`) shows OpenBB + StockPulse + Finnews items after crawl.
  - OpenBB: Quick lookup + compare + exports.
  - Finnews: Search returns matches for a high-coverage ticker (`TSLA`) + shows relevance/freshness.
  - StockPulse: Add/remove tickers + ratings history chart loads.
  - Alerts bell: shows at least one alert type within a few minutes (filing/rating/RSI).
