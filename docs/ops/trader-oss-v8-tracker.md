# Trader OSS Console v8 Tracker (Research Only)

Date: 2026-02-08

Scope:
- OpenBB + FinnewsHunter + StockPulse + in-app alerts
- Execution/portfolio/risk is **paused**
- App remains **private/allowlisted** (no auth weakening)

How we verify:
- Local dev: `bash scripts/ui-dev.sh status`
- Prod E2E: `node scripts/verify-oss-console.mjs --base https://relayorb.web.app --email <allowlisted>`

## 0) Dev Server (WSL/Windows)
- [ ] Dev server reachable from Windows at `http://localhost:5173`
- [ ] Vite HMR websocket stable (no `[vite] failed to connect to websocket`)
- [ ] Firebase Google sign-in works on dev (use `localhost`, not `127.0.0.1` / WSL IP)

## 1) Unified Watchlist (Trader -> OpenBB + StockPulse + Finnews)
Goal: symbols entered in Trader should keep the three tools in sync.
- [ ] Trader “Run lookup” writes symbols into `localStorage.openbb_watchlist`
- [ ] Trader “Run lookup” pushes symbols into StockPulse monitored list (`POST /api/stocks`)
- [ ] Trader “Run lookup” warms Finnews stock overviews (best-effort `GET /api/v1/stocks/{ticker}`)
- [ ] Trader shows a small sync status line + toasts for partial failures
- [ ] E2E verifier asserts the StockPulse sync request happens

## 2) OpenBB “Trader Visuals” Completion
- [ ] No empty technicals when history exists (RSI/MA/BB computed from candles)
- [ ] Export: JSON + CSV for key views (quick lookup, comparison, fundamentals, technicals)
- [ ] Charts render without Recharts `width(-1)/height(-1)` warnings
- [ ] “Freshness” shown where relevant (as-of timestamps, provider notes)

## 3) Finnews: Trader-Grade Quality
- [ ] CIK -> ticker mapping (asset `public/sec-cik-map.v1.json` + cache `localStorage.sec_cik_map_v1`)
- [ ] Sentiment tagging shown (real score when present; deterministic baseline otherwise)
- [ ] Search reliability UX: empty states explain what to do next (crawl vs provider vs limit)
- [ ] Relevance scoring: show “why matched” reasons (ticker/keyword/cik)
- [ ] Freshness + rate-limit hints shown for failing/slow providers

## 4) StockPulse: Scale + Persistence
- [ ] Scale beyond 20 monitored names (bulk add + “Import OpenBB”)
- [ ] Market filter applies consistently (ratings + table + “active stocks” count)
- [ ] Rating history persistence works (`/api/ai/rating-history/:ticker` + UI chart/table)

## 5) Cross-Module In-App Alerts
- [ ] Filing alerts (Finnews latest) for watchlist tickers
- [ ] Rating change alerts (StockPulse ratings) for watchlist tickers
- [ ] RSI threshold alerts (computed) for watchlist tickers
- [ ] Muting + poll button work in the bell popover

