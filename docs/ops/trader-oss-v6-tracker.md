# RelayOrb OSS Trader Console v6 Tracker

Scope: only the 3 OSS products + cross-module in-app alerts.

- In scope: `OpenBB`, `FinnewsHunter`, `StockPulse AI`, and cross-module *in-app* alerts.
- Out of scope (paused): execution, broker connectivity, portfolio, risk, ORB.

## Baseline Verification

- [ ] Prod smoke (signed-in): Trader Dashboard loads + data flows for OpenBB/Finnews/StockPulse.
- [ ] `scripts/verify-oss-console.mjs` passes on `https://relayorb.web.app` and saves an evidence screenshot.
- [ ] Local dev server reachable from Windows via `http://localhost:5170/` (NOT `127.0.0.1` or WSL IP).

## OpenBB (Trader Visuals)

- [ ] Remove/replace broken OpenBB "Company news" calls if backend returns 404.
- [ ] Technicals must never be empty when history exists (compute locally; widen lookback automatically if needed).
- [ ] Exports: JSON + CSV everywhere data exists (quick lookup, compare, watchlist snapshot).
- [ ] Polish: loading states + empty states + clear "as-of" timestamps per panel.
- [ ] Fix chart sizing warnings (Recharts width/height <= 0) defensively.

## FinnewsHunter (Trader UX)

- [ ] CIK -> ticker mapping (deterministic, cached) visible in list + detail.
- [ ] Sentiment tagging: deterministic baseline (headline + summary) when provider doesn't return sentiment.
- [ ] Search reliability UX:
  - [ ] Clear empty-state messaging (suggest removing filters / running crawl)
  - [ ] Freshness / rate-limit hints in list AND detail views.
- [ ] Relevance scoring:
  - [ ] Explain "why matched" in list AND detail views (query tokens, symbol hits, CIK mapping).
- [ ] Optional: show publish timestamps and source tier label when available.

## StockPulse AI (Scale + History)

- [ ] Watchlist scaling: support > 20 tickers (dedupe + bounded concurrency + clear progress).
- [ ] Ratings coverage: show missing tickers + one-click "compute missing".
- [ ] Rating history persistence: durable storage + chart/table + retention policy documented.
- [ ] RSI sanity: RSI should vary per ticker (no constant placeholder values).
- [ ] Currency clarity: show currency code/symbol per ticker and avoid mixing ambiguity in tables.
- [ ] AI chat: provider configured + meaningful errors when not configured.

## Cross-Module In-App Alerts

- [ ] Alerts engine: filings + rating changes + RSI thresholds.
- [ ] Alerts respect per-ticker watchlist toggles.
- [ ] Add "mute 1h" + "mute today" quick actions.
- [ ] Add alert "source" context (which module fired it) and click-through deep links.

