# Ops Dataflow Graph

Live dataflow view of the trading pipeline. The UI renders a fixed topology graph and animates edges/nodes based on pipeline events.

## Overview

- UI page: `/ops/graph`
- Event stream: Redis Stream `pipeline_events` (prefixed by `REDIS_PREFIX`)
- Stream gateway: Refresh service SSE endpoint `/ops/events`
- Topology spec: `src/ops/graph_topology.json` (fixed layout)

## Pipeline Event Schema

Each event is a JSON payload stored as `payload` in the Redis stream.

```
{
  "ts": "2026-01-10T09:21:33.123Z",
  "eventId": "uuid-or-ts",
  "runEnv": "prod",
  "batchId": "2026-01-10T09:21:00Z",
  "symbolKey": "stock:INTC",
  "service": "market-intel",
  "stationId": "mi_candidates",
  "eventType": "candidates_merge",
  "edgeKey": "movers_15m->candidates_merge",
  "nodeIds": ["market_intel", "candidates_merge"],
  "status": "start|end|error",
  "durationMs": 412,
  "severity": "info|warn|error",
  "meta": {"count": 120, "origins": {"mover15m": 80, "user_universe": 40}},
  "inputs": {"redisKeys": [], "firestoreDocs": [], "providerCalls": []},
  "outputs": {"redisKeys": [], "firestoreDocs": []},
  "error": {"message": "...", "code": "..."}
}
```

### Required fields
- `ts`, `eventId`, `service`, `stationId`, `status`
- `eventType`, `edgeKey` (required for graph pulsing)

### Graph mapping rules
- `edgeKey` **must** match an `edges[].id` in `src/ops/graph_topology.json`.
- `nodeIds` are the node IDs to glow; if missing the UI maps from `stationId`.

### Meta conventions (key fields)
- `origins`: array or map of origin tags (`mover15m`, `user_universe`, `manual`, `trending`, `other`)
- `botEngineId`, `strategy`, `timeframe`, `tradingMode` for bot events
- `providerId`, `endpointName`, `cacheHit`, `httpStatus`, `latencyMs` for provider calls

### Provenance
Symbol-level events include `meta.origins` so the UI can label where assets came from.
If origins are missing, the UI flags `UNKNOWN ORIGIN`.

Common origin tags:
- `mover15m`, `user_universe`, `manual`, `trending`, `other`, `unknown`

## Graph Topology

Defined in `src/ops/graph_topology.json`. Core nodes include:

- Stores: `redis`, `firestore`
- Services: `price_streamer`, `market_intel`, `refresh_service`, `relayorb_agent`, `signal_evaluator`, `market_data_gateway`, `chart_proxy`, `ui`
- Processors: `movers_15m`, `candidates_merge`, `score_compute` (candidate ranking in market-intel), `bot_signals`, `signal_performance`
- Providers: `provider:fmp`, `provider:marketaux`, plus dynamic `provider:*` nodes (fallback `provider:unknown`)
- Bots: `bot_engine:backtrader`, plus dynamic `bot_engine:*` nodes (fallback `bot_engine:unknown`)

Dynamic nodes are added at runtime based on events.

## Edge Mapping (current)

- `price_streamer->redis`: hot price writes
- `price_streamer->firestore`: market/prices snapshot writes
- `redis->market_intel`: movers data reads
- `firestore->market_intel`: universe/controls reads
- `market_intel->movers_15m`: movers compute
- `movers_15m->candidates_merge`: candidates merge
- `candidates_merge->score_compute`: candidate ranking
- `candidates_merge->firestore`: candidates/batches written
- `score_compute->firestore`: ranking output written
- `market_intel->new_batch`: new_batch publish
- `new_batch->refresh_service`: refresh consume
- `new_batch->relayorb_agent`: agent consume
- `firestore->refresh_service`: batch poll reads
- `refresh_service->firestore`: cursor writes
- `refresh_service->signal_evaluator`: trigger scoring/analytics job
- `firestore->relayorb_agent`: candidates read
- `relayorb_agent->bot_engine:*`: bot engine runs
- `relayorb_agent->bot_signals`: bot signals written
- `bot_signals->firestore`: bot signal writes (collection-level)
- `redis->signal_evaluator`: hot data reads
- `firestore->signal_evaluator`: signal evaluator reads
- `signal_evaluator->signal_performance`: performance aggregation
- `signal_evaluator->firestore`: performance analytics write
- `firestore->ui`: UI reads
- `chart_proxy->market_data_gateway`: chart proxy calls
- `price_streamer->market_data_gateway`: gateway calls
- `market_intel->market_data_gateway`: gateway calls
- `signal_evaluator->market_data_gateway`: gateway calls
- `market_data_gateway->provider:*`: provider calls

## Service Instrumentation (current)

- `price-streamer`: `redis_hot` -> `edgeKey=price_streamer->redis`
- `market-intel`: `mi_movers`, `mi_candidates`, `scoring`, `analysis_written`, `mi_batch_written`, `mi_new_batch`
- `refresh-service`: `refresh_trigger`, `refresh_poll`
- `relayorb-agent`: `agent`, `bot_engine:*`, `bot_signals`
- `signal-evaluator`: `signal_eval`, `signal_performance`, `fs_write`
- `market-data-gateway`: `mdg`, `provider:*`
- `chart-proxy`: `chart_proxy`

## UI Behavior

- Edges pulse with an exponential decay based on event recency.
- Nodes glow based on recent activity and error status.
- Filters: batchId, symbolKey, providerId, bot engine, only errors/bots/external, only read/write/call/trigger.
- Drilldowns: per-node/edge event list, per-batch origins, per-symbol scoring + bot signals.
- Gap detector: core edges with no recent telemetry show as gaps in Global Status.
- On-demand drilldown: `GET /ops/events/search` returns filtered history for batchId/symbolKey/edgeKey.

## Env Flags

- `PIPELINE_EVENTS_ENABLED` (default: true)
- `PIPELINE_EVENTS_STREAM` (optional override)
- `PIPELINE_EVENTS_MAXLEN` (stream retention)
- `PIPELINE_EVENTS_RUN_ENV` (default: prod)
- `PIPELINE_EVENTS_SAMPLE_RATE` (symbol-level sampling)

## Evidence

Add screenshots and recordings under `docs/ops-graph/` after verification.

Related discovery: see `docs/ops-subway/DISCOVERY_REPORT.md` for runtime inventory.
