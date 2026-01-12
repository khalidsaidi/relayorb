# Data Inventory (Discovery)

This inventory is based on runtime config + code inspection. Run discovery against prod
to refresh examples (see Discovery Blockers if unavailable).

## Firestore

| Path | Purpose | Key Fields (observed in code) | Update Source | Notes |
| --- | --- | --- | --- | --- |
| `market/prices` | Latest live prices | `updatedAt`, `items[]`, `meta{runId,count,sources,watchlist}` | price-streamer | Primary UI live price doc. |
| `market/prices_snapshot` | Snapshot used for movers fallback | `updatedAt`, `items[]`, `meta{runId,count}` | market-intel | Used when Redis snapshot missing. |
| `market/movers` | Movers feed | `updatedAt`, `markets`, `items[]`, `meta` | market-intel | 15m movers by market. |
| `market/hotTrades` | Main recommendations | `updatedAt`, `items[]`, `meta` | market-intel | Hot picks with score + recommendation. |
| `market/actionBoard` | Buy/sell split | `updatedAt`, `buys[]`, `sells[]`, `meta` | market-intel | Action board cards. |
| `market/trending` | Trend horizon lists | `updatedAt`, `items[]`, `meta` | market-intel | Trend lists by horizon. |
| `market/popular` | Popular list | `updatedAt`, `items[]` | market-intel | Aggregated view. |
| `market/candidates` | Candidate list | `updatedAt`, `items[]`, `meta{runId,count}` | market-intel | Input for bots + signal-evaluator. |
| `market/controls` | Runtime controls | `riskProfile`, `assetFocus`, `trendWeights`, etc | UI + ops | Configuration. |
| `market/universe` | Watchlist/universe | `mode`, `crypto/stocks/forex` | UI | Overlay on movers. |
| `market/streamSymbols` | Stream symbol list | `symbols`, `updatedAt` | UI | Price streamer symbol set. |
| `batches/{batchId}` | Batch history | `items[]`, `counts`, `createdAt`, `runId` | market-intel | Durable record for missed events. |
| `batch_consumers/{id}` | Consumer cursor | `lastBatchId`, `lastProcessedAt` | agent + refresh-service | Recovery cursor. |
| `bots/*/signals` | Bot signals | `symbol`, `side`, `strength`, `createdAt`, `evaluation` | relayorb-agent | Signals with evaluation. |
| `analytics/signalPerformance` | Bot performance | `updatedAt`, `overall`, `byAsset`, `topSymbols` | signal-evaluator | Signal accuracy metrics. |
| `market/refresh` | Manual refresh log | `requestedAt`, `requestedBy`, `jobs` | refresh-service | Refresh history. |

## Redis (Hot Store)

Discovery was blocked from the local environment (VPC access). The code expects these key families:

- `prices:latest` (JSON payload of latest prices)
- `prices:snapshot:*` (rolling snapshot windows)
- `events` (new_batch pubsub channel)
- `pipeline_events` (Redis stream for observability)

## Providers (via Market Data Gateway)

Providers are discovered dynamically from runtime configuration. Provider activity
emits `stationId: provider:<id>` events to the pipeline stream.

To refresh the provider inventory, run `scripts/ops-subway/discover.mjs`, which writes
`docs/ops-subway/DISCOVERY_REPORT.md`.

## Discovery Blockers

- Redis key inspection requires `REDIS_URL` and a Redis client in the discovery runtime.
- Firestore inspection requires application credentials (service account or ADC).
- Provider inventory is derived from MDG config; missing env/config prevents listing.
