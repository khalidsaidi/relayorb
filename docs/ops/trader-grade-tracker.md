# RelayOrb Trader-Grade Tracker (OpenBB + StockPulse + Finnews)

This file is the source of truth for what "done" means and what remains.

## Progress

- Target: close every `[ ]` in this file.
- Current: build is green (`npm run build`), local dev runs in `tmux relayorb_dev`.

## Definition Of Done (Trader-Grade)

- No generic "Failed to fetch": every error shows `service + endpoint + status + actionable hint`.
- OpenBB:
  - Quote renders as a readable card (not JSON).
  - Price history renders as a chart (no empty boxes).
  - Compare renders a real side-by-side view + normalized performance.
  - Fundamentals renders tables (income/balance/cashflow) + key ratios.
  - Technicals renders indicators (RSI/MA/BB) with clear values + chart overlays.
  - Raw JSON is always available, but never the default primary view.
- StockPulse:
  - AI chat works (provider configured) and errors are actionable.
  - Market filter applies consistently across: stats, active list, ratings table, news/alerts.
  - Ratings load fast (target: < 2s typical) and never block the UI for ~30s+.
  - Missing ratings are explicit per ticker (row shows error), not silently absent.
- Explorer:
  - OpenBB Explorer covers every endpoint from OpenAPI and renders results as table/chart/cards.
  - StockPulse Explorer covers every backend route with parameter help and result rendering.
- Charts:
  - No Recharts `width(-1)/height(-1)` warnings in normal usage (tabs/resize included).
- Deployment:
  - `https://relayorb.web.app` works end-to-end against VM services.

## Current State (Facts)

- Local dev UI is served from WSL via `tmux` session `relayorb_dev` on `0.0.0.0:5173`.
- Hosting: `https://relayorb.web.app`
- VM backend base: `https://relayorb.34-182-77-163.sslip.io`
  - OpenBB: `/openbb`
  - StockPulse: `/stockpulse`
  - Finnews: `/finnews`

## Work Items

### A) Reliability And Observability (Cross-Cutting)

- [x] A1. Add per-page endpoint badge + one-click health check (OpenBB/StockPulse/Finnews).
- [x] A2. Standardize fetch error display: show service, URL, status, body excerpt, hint.
- [x] A3. Fix Recharts sizing warning robustly (render only after container has measured size).
- [x] A4. Add request timeout + retry policy for UI fetches where appropriate (no infinite hangs).

### B) OpenBB (Trader UI)

- [x] B1. Fix base-path URL join so `/openbb` is never dropped (prevents false "online" responses).
- [x] B2. Toast on empty `results: []` payloads (e.g., Intrinio returning empty).
- [x] B3. Price history: add candlestick + volume view (keep line as optional).
- [x] B4. Compare: normalized performance chart (% from start) + real side-by-side metrics table.
- [x] B5. Fundamentals: statement tables (income/balance/cashflow) + ratios (P/E, P/B, yield, etc.).
- [x] B6. Technicals: indicator selector (RSI/MA/BB) + chart overlays + "key signals" panel.
- [x] B7. Watchlist: persistence + clear UI state (add/remove, saved views, re-open).
- [ ] B8. Explorer polish: endpoint descriptions, parameter defaults, templates for common tasks.

### C) StockPulse (Expose Everything + Performance)

- [ ] C1. Fix AI chat (seed provider on backend; `/api/chat/ask` returns success).
- [x] C2. Apply market filter consistently to ratings table (filter by `/api/stocks?market=...`).
- [ ] C3. Make `/api/ai/ratings` fast: cache + parallelize + avoid LLM calls in bulk path.
- [x] C4. Add explicit per-ticker error rows when rating calc fails (no silent drops).
- [ ] C5. Add StockPulse Explorer tab (all routes, params, render results).
- [ ] C6. Ensure US watchlist coverage is complete (bulk import + verify all active tickers show).

### D) Finnews (US Trader Defaults)

- [ ] D1. Ensure default market is US and UI defaults to US sources/filters.
- [ ] D2. Improve result drill-down: highlight tickers/CIKs, “Open in SEC” and “Open in source”.

## Verification Checklist (Run Before Marking 100%)

- [ ] OpenBB: quick lookup AAPL works; chart renders; compare AAPL,MSFT works; fundamentals show tables.
- [ ] StockPulse: US filter hides non-US tickers everywhere; ratings load fast; chat works; chart loads.
- [ ] Hosting: `relayorb.web.app` has no "Failed to fetch" for the above flows.
- [ ] No chart sizing warnings in console during normal tab switching.

## Notes

- "Expose everything" does not mean "dump JSON everywhere". It means "make every capability discoverable and usable".
- Intrinio currently returns empty quote results for AAPL even with a key; UI should treat it as a valid provider but show a clear empty-data toast.

## Dev Server (WSL/Windows)

- Dev should always be started via `npm run dev` (it runs `scripts/dev-wsl.sh`).
- If HMR websockets fail from Windows, confirm the page is opened via the WSL IP shown at startup (not IPv6 `localhost`).
