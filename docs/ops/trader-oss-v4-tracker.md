# RelayOrb OSS Trader Console Tracker (v4)

Scope: RelayOrb is a private Control Deck integrating only 3 OSS products:
- OpenBB (market data + trader visuals)
- FinnewsHunter (SEC/news crawler)
- StockPulse AI (sentiment/ratings/chat)

Out of scope (paused): execution, broker, portfolio, risk.

## Conventions
- `Implemented` means code shipped.
- `Verified (Prod)` means verified end-to-end on `https://relayorb.web.app` (signed-in).
- `Verified (Dev)` means verified end-to-end on the local dev server (signed-in).

## Dev Server & Auth
- [ ] Implemented: Dev server reachable from Windows `localhost` even when it resolves to IPv6 (`::1`)
- [ ] Verified (Dev): Windows can load UI from `http://localhost:<port>/` and HMR is connected
- [ ] Implemented: Clear sign-in guidance (use `localhost`, avoid `127.0.0.1` / WSL IP unless whitelisted)

## OpenBB (Trader Visuals)
- [ ] Implemented: Quote card (price/bid/ask/vol + key metrics)
- [ ] Implemented: Historical chart renders reliably (no zero-size Recharts warnings)
- [ ] Implemented: Technicals never show empty placeholders when history exists (compute RSI/MA/BB locally)
- [ ] Implemented: Exports (JSON/CSV where applicable) for quick lookup + compare
- [ ] Implemented: Provider dropdown only shows configured providers (yfinance + intrinio)
- [ ] Implemented: “Freshness” hints (timestamp, provider, interval)
- [ ] Verified (Prod): Quick Lookup works for `AAPL` (quote + chart + technicals)
- [ ] Verified (Prod): Compare works for `AAPL,MSFT` (table + chart)
- [ ] Verified (Prod): Export works (download triggers)

## Finnews (CIK→Ticker, Sentiment, Search UX)
- [ ] Implemented: CIK→ticker enrichment (SEC map + caching)
- [ ] Implemented: Sentiment tagging (deterministic baseline + provider label)
- [ ] Implemented: Search reliability UX (stale, rate-limit hints, crawl guidance)
- [ ] Implemented: Relevance scoring + “why matched” reasons
- [ ] Implemented: Freshness hints (last crawl time, cadence estimate)
- [ ] Verified (Prod): Latest shows tickers populated for SEC items
- [ ] Verified (Prod): Search for `Tesla` returns results or shows a clear “no results” + hints (not silent)
- [ ] Verified (Prod): Sentiment + relevance chips visible on items

## StockPulse (Scale + History Persistence)
- [ ] Implemented: Watchlist scaling beyond 20 (bulk import + OpenBB watchlist import)
- [ ] Implemented: Ratings table market filter consistency (US filter applies everywhere)
- [ ] Implemented: Rating history persistence (backend + UI chart/table)
- [ ] Implemented: AI chat hardening (actionable error if provider missing)
- [ ] Verified (Prod): Add/import > 20 symbols and see ratings load
- [ ] Verified (Prod): US filter removes non-US tickers from ratings table
- [ ] Verified (Prod): Rating history shows for a ticker (e.g. `AAPL`)
- [ ] Verified (Prod): Chat returns an answer (or shows actionable configuration error)

## Cross-Module Alerts (In-App)
- [ ] Implemented: In-app alerts bell + settings
- [ ] Implemented: Filing alerts (Finnews) for OpenBB watchlist symbols
- [ ] Implemented: Rating-change alerts (StockPulse) for OpenBB watchlist symbols
- [ ] Implemented: RSI threshold alerts (StockPulse RSI) for OpenBB watchlist symbols
- [ ] Verified (Prod): Poll alerts runs without errors and produces alerts when conditions met

## Deployment
- [ ] Verified (Prod): `https://relayorb.web.app` uses the intended VM endpoints (Endpoints menu)
- [ ] Verified (Prod): All 3 services show healthy in the Endpoints health check

