# FinnewsHunter Full Console Implementation Plan

## Scope
Deliver a complete FinnewsHunter console: search/filter/table/detail, watchlist, alerts, dashboard summary, all via HTTPS endpoints. Proxy through MDG to the finnews service; keep OpenBB/StockPulse intact.

## Work Items

### 1) Backend Proxy (MDG)
- Add proxy routes mapping to finnewshunter:
  - GET /v1/finnews/search → /api/v1/news/search
  - GET /v1/finnews/company/:ticker → /api/v1/company/:ticker
  - GET /v1/finnews/filing/:id → /api/v1/news/:id
  - Watchlist: GET/POST/PUT/DELETE /v1/finnews/watchlist[…]
  - Alerts: GET/PUT/DELETE /v1/finnews/alerts[…]
  - Analytics: GET /v1/finnews/analytics/summary, /trending, /sector
- Ensure CORS/auth same as existing finnews proxy.
- Rebuild/restart MDG on VM.

### 2) Frontend Console (React)
- New `/finnews` console page with:
  - SearchBar (query/suggestions/recent)
  - FilterSidebar (date range, filing types, sources, sentiment, risk flag, sort, reset)
  - ResultsTable (headline, company, type, date, sentiment badge, risk flags, actions)
  - DetailModal (tabs: Filing Details, Risk, Timeline, Raw Content)
  - WatchlistPanel (add/remove/configure alerts)
  - DashboardSummary (new filings today, critical alerts, trending companies, watchlist changes)
  - AlertSettingsModal (types, channels, digest)
- Hooks: useSearch, useWatchlist, useAlerts calling new proxy endpoints.
- “View at SEC” links to filing URL; “Save/Watch” uses watchlist APIs.
- Styling consistent with current app; no legacy StockPulse changes.

### 3) Provider/UI Consistency
- OpenBB providers: yfinance + intrinio; FMP hidden until key works.
- Keep HTTPS endpoints via relayorb.34-182-77-163.sslip.io to avoid mixed-content.

### 4) Deploy & Verify
- Rebuild frontend; deploy Firebase hosting.
- Verify over HTTPS: /healthz, /finnews/search, quotes, etc.
- Keep local dev server running on 0.0.0.0:5173.

### 5) Out of Scope (for now)
- No finnewshunter backend schema changes.
- No new sentiment/entity/risk pipelines (reuse existing finnews outputs).
- No legacy StockPulse “AI Analysis” fixes unless explicitly requested.

## Status Tracking
- Backend proxy routes: TODO
- Frontend console components/hooks: TODO
- Env HTTPS wiring (done): DONE
- Deploy & verify: TODO after implementation
- Local dev server running: DONE
