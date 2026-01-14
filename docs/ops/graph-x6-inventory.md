Ops Graph Inventory (Pre-X6)

Source of truth
- Topology: `src/ops/graph_topology.json`
- Live events: `src/features/ops/use-pipeline-events.ts` (SSE stream from `${VITE_REFRESH_URL}/ops/events?tail=300`)

Nodes currently defined (23)
- provider:fmp (FMP)
- provider:marketaux (Marketaux)
- provider:coingecko (CoinGecko)
- provider:unknown (Provider (Other))
- market_data_gateway (Market Data Gateway)
- chart_proxy (Chart Proxy)
- price_streamer (Price Streamer)
- redis (Redis Hot Store)
- market_intel (Market Intel)
- movers_15m (Movers 15m)
- candidates_merge (Candidates Merge)
- score_compute (Candidate Ranking (MI))
- firestore (Firestore)
- ui (UI)
- new_batch (Redis Stream: new_batch)
- refresh_service (Refresh Service)
- relayorb_agent (RelayOrb Agent)
- bot_engine:freqtrade (Freqtrade)
- bot_engine:backtrader (Backtrader)
- bot_engine:unknown (Bot Engine (Other))
- bot_signals (Bot Signals (Firestore))
- signal_evaluator (Signal Evaluator (Performance))
- signal_performance (Signal Performance Report)

Dynamic nodes from event stream (added when seen)
- provider:* (from stationId/edgeKey/meta.provider)
- bot_engine:* (from stationId/edgeKey/meta.engine)

Edges currently defined (33)
- call: 10
- write: 8
- read: 7
- event: 7
- trigger: 1

Edge label rules (from topology)
- labelMode = always for core CALL/WRITE/EVENT/TRIGGER edges.
- unlabeled edges default to kind label for write/call/event/trigger.

Live update behavior
- SSE stream emits events with { ts, eventId, stationId, edgeKey, nodeIds, status, durationMs, meta, ... }.
- `usePipelineEvents` buffers up to 500 events and pushes newest-first on arrival.

Flicker / layout instability sources (current)
- Live events trigger React renders; graph elements are regenerated and re-added on each update.
- Layout adjustments occur via element rebuilds rather than incremental style updates, so edges/labels can jump.
