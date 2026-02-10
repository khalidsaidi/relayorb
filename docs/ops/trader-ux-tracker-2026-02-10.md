# Trader UX Tracker (2026-02-10)

Scope: RelayOrb OSS Console (Trader + OpenBB + FinnewsHunter + StockPulse).  
Out of scope (paused): execution, portfolio, risk.

## Status
- Goal: Trader-ready UX (no broken flows, no misleading UI, readable outputs).
- Definition of done: build passes, Firebase hosting deployed, and a signed-in browser pass on `https://relayorb.web.app` confirms the checklist.

## Checklist

### Dev Server
- [ ] Dev server runs in tmux and is reachable from Windows at `http://localhost:5300/`.
- [ ] HMR websocket works (no `[vite] failed to connect to websocket`).

### Trader Dashboard
- [ ] Symbols input is not pre-filled with a static list; optional "Load last run" is available.
- [ ] Cards have a clear path to full details (no "trapped" truncated analysis).
- [ ] Watchlist sync counters match reality (OpenBB / StockPulse / Finnews).
- [ ] Toasts do not block/overlay card content.

### OpenBB
- [ ] Fundamentals/Profile layout is readable (no squished label/value, long names wrap cleanly).
- [ ] Watchlist "Snapshot" table has stable column widths (no clipped headers).
- [ ] Charts render without `recharts width(-1)/height(-1)` warnings.

### FinnewsHunter
- [ ] Latest News + Search tables show full "Sentiment" header (no `Sent...` truncation).
- [ ] Signed-in user can search and understand empty-state messaging.

### StockPulse
- [ ] AI ratings table "Summary" column is readable (wrap/tooltip + row-click detail).
- [ ] Signed-in browser pass confirms rating detail loads on row click.

## Notes
- Keep the app private/allowlisted; do not weaken auth.
