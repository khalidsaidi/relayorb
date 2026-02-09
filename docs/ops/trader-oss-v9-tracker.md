# Trader OSS Console v9 Tracker (Research Only)

Date: 2026-02-08

Scope:
- Integrated OSS tools only: OpenBB + FinnewsHunter + StockPulse
- Execution/portfolio/risk is **paused**
- App remains **private/allowlisted** (no auth weakening)

Evidence / how we verify:
- Dev server: `bash scripts/ui-dev.sh status`
- Local E2E: `node scripts/verify-oss-console.mjs --base http://localhost:5173 --email <allowlisted>`
- Prod E2E: `node scripts/verify-oss-console.mjs --base https://relayorb.web.app --email <allowlisted>`

---

## 0) Dev Server (WSL/Windows)
- [x] Dev server managed by tmux: `bash scripts/ui-dev.sh start|stop|restart|status|logs`
- [x] Port fixed at `5300` by default (override via `VITE_DEV_PORT=...`)
- [x] Listens on IPv4 all-interfaces (`0.0.0.0`) for Windows reachability
- [x] HMR points to `ws://127.0.0.1:<port>/` (avoids IPv6-first `localhost` WS failures)
- [x] Firebase Google sign-in guidance:
  Use `http://localhost:5300/` (or whichever `VITE_DEV_PORT` you run) in dev. Avoid `127.0.0.1` / WSL IP unless they’re added to Firebase Authorized Domains.

---

## 1) Unified Watchlist (Trader -> OpenBB + StockPulse + Finnews)
Goal: symbols entered in Trader should keep the three tools in sync.
- [x] Trader “Run lookup” merges symbols into `localStorage.openbb_watchlist`
- [x] Trader “Run lookup” pushes symbols into StockPulse monitored list (`POST /api/stocks`)
- [x] Trader “Run lookup” warms Finnews stock overviews (best-effort `GET /api/v1/stocks/{ticker}`)
- [x] Trader shows a sync status line + toasts for partial failures
- [x] E2E verifier asserts the StockPulse sync request happens

Files:
- `src/pages/TraderDashboardPage.tsx`
- `scripts/verify-oss-console.mjs`

---

## 2) OpenBB “Trader Visuals”
- [x] No empty technicals when history exists:
  Technicals are computed from candle history in the UI as a deterministic fallback.
- [x] Export: JSON + CSV for key views (quick lookup, comparison, fundamentals, technicals)
- [x] Charts render via `ChartFrame` (prevents negative/zero size warnings in typical layouts)
- [x] “Freshness” shown where relevant (as-of timestamps + provider hints)

Files:
- `src/pages/OpenbbPage.tsx`
- `src/components/charts/ChartFrame.tsx`

---

## 3) Finnews: Trader-Grade Quality
- [x] CIK -> ticker mapping:
  Hosted asset `public/sec-cik-map.v1.json` is cached in `localStorage.sec_cik_map_v1`.
- [x] Sentiment tagging:
  Uses backend score when present; otherwise a deterministic baseline is shown (keyword-weighted).
- [x] Search reliability UX:
  Empty/rate-limit/stale hints shown (cadence estimate + last task errors).
- [x] Relevance scoring:
  “Why matched” reasons shown (ticker/keyword/cik) with a numeric score.

Files:
- `public/sec-cik-map.v1.json`
- `src/pages/FinnewsPage.tsx`

---

## 4) StockPulse: Scale + Persistence
- [x] Scale beyond 20 monitored names:
  Bulk add + import OpenBB watchlist.
- [x] Market filter applies consistently:
  Ratings endpoint supports `?market=` and frontend uses it.
- [x] Rating history persistence:
  Backend patch stores `rating_history` in sqlite and exposes `/api/ai/rating-history/:ticker`.

Files:
- `src/pages/StockpulsePage.tsx`
- `deploy/stockpulse-ai/patches/stockpulse-ai.patch`
- `deploy/stockpulse-ai/entrypoint.sh` (seeds AI provider from env if provided)

---

## 5) Cross-Module In-App Alerts
- [x] Filing alerts (Finnews latest) for watchlist tickers
- [x] Rating change alerts (StockPulse ratings) for watchlist tickers
- [x] RSI threshold alerts (from StockPulse RSI field)
- [x] Muting + poll button work in the bell popover

Files:
- `src/features/alerts/use-inapp-alerts.ts`
- `src/features/alerts/AlertsBell.tsx`

---

## Verified Runs
- [x] Local E2E passed (`tmp.verify-oss-console.ok.png`)
- [x] Prod E2E passed (`tmp.verify-oss-console.ok.png`)
