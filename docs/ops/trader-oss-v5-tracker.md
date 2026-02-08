# RelayOrb OSS Trader Console v5 Tracker

Scope: only the 3 OSS products + cross-module alerts.

- In scope: `OpenBB`, `FinnewsHunter`, `StockPulse AI`, and cross-module in-app alerts.
- Out of scope (paused): execution, broker connectivity, portfolio, risk, ORB.

## Verification (Prod)

- [x] `scripts/verify-oss-console.mjs` passes on `https://relayorb.web.app` (Trader + OpenBB + Finnews + StockPulse + Alerts).
- [x] Capture a success screenshot (`tmp.verify-oss-console.ok.png`) for audit evidence.

## Dev Server (WSL ↔ Windows)

- [x] Dev server reachable from Windows via `http://localhost:5170/` (WSL port-forward safe).
- [x] HMR websocket uses `ws://localhost:5170/` (no `127.0.0.1` in client HMR host).
- [ ] Document the one-liner start/stop flow (`scripts/ui-dev.sh`) in `docs/ops/dev-server-wsl.md`.

## OpenBB (Trader Visuals)

- [x] Quote cards render readable metrics (bid/ask/hi/lo/volume + as-of hints).
- [x] Historical candles render as a chart (not raw JSON).
- [x] Technicals computed locally from candles (RSI/MA/BB) so they are not empty when history exists.
- [x] Compare view: normalized (%) and raw price chart.
- [x] Exports: JSON + CSV.
- [x] Watchlist persistence + snapshot refresh.
- [ ] Remove/replace the broken OpenBB “company news” calls if the OpenBB backend returns 404.
- [ ] Fix any remaining chart container sizing warnings (e.g. Recharts width/height < 1).

## FinnewsHunter (Trader UX)

- [x] CIK → ticker mapping applied in UI (SEC map cached in `localStorage.sec_cik_map_v1`).
- [x] Sentiment tagging: deterministic baseline when provider does not return sentiment.
- [x] Search reliability UX: show rate-limit / stale-feed hints when relevant.
- [x] Relevance scoring: explain why an item matched (symbols/query/CIK).
- [ ] Add “why matched” + “freshness/rate-limit” hints to the *detail view* (not only list rows).

## StockPulse AI (Scale + History)

- [x] Market filter applies consistently to ratings + active stocks.
- [x] Bulk import beyond 20 tickers (dedupe + bounded concurrency).
- [x] Ratings coverage UI: show missing tickers + “compute missing now”.
- [x] Rating history endpoint + UI chart/table.
- [x] AI providers UI: configure + test + activate; chat uses active provider.
- [ ] Default AI provider bootstrap (optional): if an OpenAI key is present in server secrets, auto-seed the first provider.
- [ ] RSI sanity: ensure RSI varies (no constant placeholder values).
- [ ] Currency display: explicitly show currency code/symbol per ticker (avoid mixing ambiguity).

## Cross-Module In-App Alerts

- [x] Alerts bell UI + settings.
- [x] Alerts types: SEC filings + rating changes + RSI bucket thresholds.
- [x] Alerts respect OpenBB watchlist per-ticker toggles.
- [ ] Add “mute for 1h” / “mute for today” quick actions.
