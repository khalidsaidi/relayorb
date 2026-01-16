# Endpoint Audit (Intent + Callers + Evidence)

Scope and evidence:
- Cloud Run logs: last 7 days (services + jobs).
- Chart Proxy logs: last 30 days.
- Bot host containers do not emit access logs, so bot-engine API usage is inferred from agent config + agent logs.

Legend:
- Active: observed in runtime logs or scheduler config.
- Not observed: not seen in logs within the window.
- Unknown: client-only or no access logs.

## Ingress endpoints (services we run)

### Market Data Gateway (`deploy/market-data-gateway/src/index.js`)
- `GET /`  
  Intent: generic liveness endpoint.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /healthz`  
  Intent: health probe for platform monitoring.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /readyz`  
  Intent: readiness probe.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /ping/fmp`  
  Intent: validate FMP key/connectivity.  
  Callers: `deploy/pipeline-alerts/test-gateway-quote.js`.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /ping/marketaux`  
  Intent: validate Marketaux key/connectivity.  
  Callers: `deploy/pipeline-alerts/test-gateway-quote.js`.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/quote`  
  Intent: single-symbol quote for live prices.  
  Callers: `deploy/price-streamer/src/index.js`, `deploy/market-intel/src/index.js`.  
  Evidence: MDG access logs show repeated `/v1/fmp/quote`.  
  Status: Active.
- `GET /v1/fmp/quotes`  
  Intent: multi-symbol quote (batch).  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/candles`  
  Intent: candles for movers/scoring/bots.  
  Callers: `deploy/market-intel/src/index.js`, `deploy/signal-evaluator/src/index.js`, `deploy/chart-proxy/src/index.js`, `deploy/bot-host/backtrader/datafeeds.py` (via MDG).  
  Evidence: MDG access logs show repeated `/v1/fmp/candles`.  
  Status: Active.
- `GET /v1/fmp/biggest-gainers`  
  Intent: stock discovery (top gainers).  
  Callers: `deploy/price-streamer/src/index.js`.  
  Evidence: not observed in logs yet (pending deploy).  
  Status: Not observed.
- `GET /v1/fmp/biggest-losers`  
  Intent: stock discovery (top losers).  
  Callers: `deploy/price-streamer/src/index.js`.  
  Evidence: not observed in logs yet (pending deploy).  
  Status: Not observed.
- `GET /v1/fmp/most-actives`  
  Intent: stock discovery (most active).  
  Callers: `deploy/price-streamer/src/index.js`.  
  Evidence: not observed in logs yet (pending deploy).  
  Status: Not observed.
- `GET /v1/fmp/search-symbol`  
  Intent: UI symbol search by ticker.  
  Callers: `src/features/market/use-fmp-data.ts`.  
  Evidence: not observed in logs yet (pending UI deploy).  
  Status: Not observed.
- `GET /v1/fmp/search-name`  
  Intent: UI symbol search by company name.  
  Callers: `src/features/market/use-fmp-data.ts`.  
  Evidence: not observed in logs yet (pending UI deploy).  
  Status: Not observed.
- `GET /v1/fmp/stock-list`  
  Intent: refresh full stock universe cache.  
  Callers: `deploy/market-intel/src/index.js`.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/crypto`  
  Intent: crypto markets snapshot.  
  Callers: `deploy/market-intel/src/index.js`, `deploy/price-streamer/src/index.js` (if configured).  
  Evidence: MDG access logs show `/v1/fmp/crypto`.  
  Status: Active.
- `GET /v1/fmp/indicators`  
  Intent: technical indicators for scoring.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/profile`  
  Intent: company profile enrichment.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/news`  
  Intent: stock news feed.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/price-target`  
  Intent: analyst target consensus.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/ratings`  
  Intent: analyst ratings (alias for ratings-snapshot).  
  Callers: legacy clients (none observed).  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/ratings-snapshot`  
  Intent: analyst ratings snapshot.  
  Callers: `src/features/market/use-fmp-data.ts`.  
  Evidence: not observed in logs yet (pending UI deploy).  
  Status: Not observed.
- `GET /v1/fmp/ratings-historical`  
  Intent: analyst ratings history.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/grades`  
  Intent: analyst grades.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/grades-historical`  
  Intent: analyst grades history.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /v1/fmp/grades-consensus`  
  Intent: analyst grades consensus for scoring.  
  Callers: `deploy/market-intel/src/index.js`.  
  Evidence: MDG access logs show `/v1/fmp/grades-consensus`.  
  Status: Active.
- `GET /v1/marketaux/news`  
  Intent: news/sentiment feed for scoring.  
  Callers: `deploy/market-intel/src/index.js`.  
  Evidence: MDG access logs show `/v1/marketaux/news`.  
  Status: Active.

### Refresh Service (`deploy/refresh-service/src/index.js`)
- `GET /health`  
  Intent: health probe.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /readyz`  
  Intent: readiness probe.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `GET /ops/events`  
  Intent: SSE stream for ops dashboards.  
  Callers: `src/pages/OpsGraphX6Page.tsx`, `scripts/ops-graph/capture-graph.mjs`, `scripts/ops-subway/capture-subway.mjs`, `scripts/ops-subway/check-sse.mjs`.  
  Evidence: access logs show `/ops/events`.  
  Status: Active.
- `GET /ops/events/search`  
  Intent: filtered event history for drilldowns.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `POST /refresh`  
  Intent: manual refresh trigger.  
  Callers: UI/admin tooling (not hard-coded in repo).  
  Evidence: access logs show `/refresh`.  
  Status: Active.
- `POST /admin/scanOnce`  
  Intent: admin-only scan trigger.  
  Callers: none in repo.  
  Evidence: no access logs.  
  Status: Not observed.
- `POST /advice`  
  Intent: AI advice for Trade Now page.  
  Callers: `src/pages/TradeNowPage.tsx`.  
  Evidence: access logs show `/advice`.  
  Status: Active.

### Chart Proxy (`deploy/chart-proxy/src/index.js`)
- `GET /chartProxy`  
  Intent: chart data proxy via MDG.  
  Callers: UI chart widgets (not directly referenced in UI).  
  Evidence: no access logs (30d window).  
  Status: Not observed.

## Bot engine APIs (internal, called by agent)

### Backtrader API (`deploy/bot-host/backtrader/app.py`)
Note: no access logs in container, so usage is inferred from config + manual probes.
- `GET /ping`  
  Intent: reachability check.  
  Callers: `agent/src/index.js` (BacktraderAdapter.poll).  
  Evidence: manual probe returned 200.  
  Status: Active (manual probe).
- `GET /health`  
  Intent: health details.  
  Callers: `agent/src/index.js`.  
  Evidence: manual probe returned 200.  
  Status: Active (manual probe).
- `GET /status`  
  Intent: bot status.  
  Callers: `agent/src/index.js`.  
  Evidence: manual probe returned 200.  
  Status: Active (manual probe).
- `GET /signals`  
  Intent: signal output retrieval.  
  Callers: `agent/src/index.js`.  
  Evidence: manual probe timed out after 10s.  
  Status: Unresponsive (manual probe).
- `GET /balance`  
  Intent: balances snapshot.  
  Callers: `agent/src/index.js`.  
  Evidence: manual probe returned 200.  
  Status: Active (manual probe).
- `GET /logs`  
  Intent: log retrieval for visibility.  
  Callers: `agent/src/index.js`.  
  Evidence: manual probe returned 200.  
  Status: Active (manual probe).
- `POST /run`  
  Intent: run strategy with provided symbols.  
  Callers: `agent/src/index.js` (BacktraderAdapter.maybeRunStrategy).  
  Evidence: not invoked manually to avoid triggering a run.  
  Status: Not observed.

Backtrader configuration evidence:
- Agent config includes backtrader bots for crypto/stocks/forex.  
  Evidence: `docker exec bot-host-relayorb-agent-1 cat /config/config.json`.  
  Agent logs show `ag_scan_complete` + `ag_write_bot_signals` for backtrader bots.  
  Manual probes confirm the API is reachable (except `/signals` timing out).

## Egress endpoints (external APIs)

### Financial Modeling Prep (FMP)
Used by MDG, Price Streamer, Backtrader fallback.
- `https://financialmodelingprep.com/stable/quote`  
  Intent: quotes for live price stream.  
  Callers: MDG (`/v1/fmp/quote`), Price Streamer fallback.  
  Evidence: MDG access logs show `/v1/fmp/quote`.  
  Status: Active.
- `https://financialmodelingprep.com/stable/historical-chart/{interval}`  
  Intent: candles for movers/scoring/bots.  
  Callers: MDG (`/v1/fmp/candles`), Backtrader fallback.  
  Evidence: MDG access logs show `/v1/fmp/candles`.  
  Status: Active.
- `https://financialmodelingprep.com/stable/stock-list`  
  Intent: full ticker universe refresh.  
  Callers: MDG (`/v1/fmp/stock-list`), Market Intel.  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/technical-indicators/{indicator}`  
  Intent: technical indicators.  
  Callers: MDG (`/v1/fmp/indicators`).  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/profile`  
  Intent: company profile enrichment.  
  Callers: MDG (`/v1/fmp/profile`).  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/news/stock`  
  Intent: news feed.  
  Callers: MDG (`/v1/fmp/news`).  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/price-target-consensus`  
  Intent: analyst target consensus.  
  Callers: MDG (`/v1/fmp/price-target`).  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/rating`  
  Intent: analyst rating.  
  Callers: MDG (`/v1/fmp/ratings`).  
  Evidence: no access logs.  
  Status: Not observed.
- `https://financialmodelingprep.com/stable/grades-consensus`  
  Intent: analyst grades for scoring.  
  Callers: MDG (`/v1/fmp/grades-consensus`).  
  Evidence: MDG access logs show `/v1/fmp/grades-consensus`.  
  Status: Active.
- `https://financialmodelingprep.com/stable/aftermarket-quote`  
  Intent: extended-hours quotes when market closed.  
  Callers: Price Streamer fallback (`deploy/price-streamer/src/index.js`).  
  Evidence: no direct logs.  
  Status: Unknown.

### Marketaux
- `https://api.marketaux.com/v1/news/all`  
  Intent: news/sentiment feed.  
  Callers: MDG (`/v1/marketaux/news`), Market Intel.  
  Evidence: MDG access logs show `/v1/marketaux/news`.  
  Status: Active.

### OpenAI
- `https://api.openai.com/v1/chat/completions`  
  Intent: AI advice + market-intel enrichments.  
  Callers: `deploy/refresh-service/src/index.js`, `deploy/market-intel/src/index.js`.  
  Evidence: market-intel logs show OpenAI usage; `/advice` is active.  
  Status: Active.

### Tavily
- `https://api.tavily.com/search`  
  Intent: web search for advice enrichment.  
  Callers: `deploy/refresh-service/src/index.js`.  
  Evidence: no usage logs.  
  Status: Not observed.

### SerpAPI
- `https://serpapi.com/search.json`  
  Intent: fallback web search for advice enrichment.  
  Callers: `deploy/refresh-service/src/index.js`.  
  Evidence: no usage logs.  
  Status: Not observed.

### TradingView
- `https://www.tradingview.com/widgetembed/`  
  Intent: client chart widget.  
  Callers: `src/pages/LiveChartsPage.tsx`, `src/components/charts/AssetChartModal.tsx`.  
  Evidence: client-only.  
  Status: Unknown.

### Firebase Identity Toolkit
- `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken`  
  Intent: Firebase auth for the UI.  
  Callers: Firebase SDK (client).  
  Evidence: client-only.  
  Status: Unknown.

## Control plane endpoints (Google Cloud)

### Cloud Run Jobs (invoked by Cloud Scheduler)
- `https://us-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/relayorb/jobs/pipeline-alerts:run`  
  Intent: run alert job on schedule.  
  Callers: Cloud Scheduler `pipeline-alerts-scheduler`.  
  Evidence: scheduler config.  
  Status: Active.
- `https://us-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/relayorb/jobs/relayorb-market-intel:run`  
  Intent: run market-intel job on schedule.  
  Callers: Cloud Scheduler `relayorb-market-intel`.  
  Evidence: scheduler config.  
  Status: Active.
- `https://us-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/relayorb/jobs/relayorb-signal-evaluator:run`  
  Intent: run signal-evaluator job on schedule.  
  Callers: Cloud Scheduler `relayorb-signal-evaluator`.  
  Evidence: scheduler config.  
  Status: Active.

## Notes / Gaps
- Price Streamer now targets `/v1/fmp/biggest-gainers`, `/v1/fmp/biggest-losers`, `/v1/fmp/most-actives` (pending deploy + log confirmation).
- Bot engine API usage cannot be confirmed without access logs inside the containers. Agent logs show backtrader bots scheduled, but no per-endpoint evidence.
