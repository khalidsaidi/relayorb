# Ops Subway Map

Live observability view for the trading pipeline. The UI renders a fixed subway map and animates batch trains based on pipeline events emitted by backend services.

## Overview

- UI page: `/ops/subway`
- Event stream: Redis Stream `pipeline_events` (prefixed by `REDIS_PREFIX`)
- Stream gateway: Refresh service SSE endpoint `/ops/events`
- Map spec: `src/ops/subway_map_spec.json` (fixed layout)

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

### Common meta fields
- `meta.origins`: list or count map of provenance tags (required for symbol-level candidates).
- `meta.tradingMode`: bot safety mode (`paper` expected).
- `meta.providerId`, `meta.endpointName`, `meta.httpStatus`, `meta.cacheHit`: provider usage.
- `meta.score`, `meta.action`, `meta.holdMinutes`, `meta.stopLossPct`, `meta.takeProfitPct`, `meta.confidence`: scoring outputs.

### Provenance
Symbol-level events include `meta.origins` so the UI can label where assets came from.
If origins are missing, the UI flags `UNKNOWN ORIGIN`.

Common origin tags:
- `mover15m`, `user_universe`, `manual`, `trending`, `other`, `unknown`

## Station Map

Station list is defined in `src/ops/subway_map_spec.json`. Core line stations:

- `redis_hot` -> `mi_movers` -> `mi_candidates` -> `scoring` -> `analysis_written`
- `mi_batch_written` -> `mi_new_batch` -> `refresh_trigger` -> `agent` -> `bot_signals` -> `signal_eval` -> `ui_visible`
- `mi_new_batch` -> `refresh_poll` (missed batch polling)

Provider line (dynamic):
- `mdg` -> `provider:*` (stations are discovered from runtime events) + `provider:unknown`

Bots line (dynamic):
- `agent` -> `bot_engine:*` + `bot_engine:unknown`

Charts line:
- `chart_proxy` -> `mdg`

## Service Instrumentation (current)

- `price-streamer`: emits `redis_hot`
- `market-intel`: emits `mi_movers`, `mi_candidates`, `scoring`, `analysis_written`, `mi_batch_written`, `mi_new_batch`
- `refresh-service`: emits `refresh_trigger`, `refresh_poll`
- `relayorb-agent`: emits `agent`, `bot_engine:*`, `bot_signals`
- `signal-evaluator`: emits `signal_eval`, `signal_performance`
- `market-data-gateway`: emits `mdg` and `provider:*`
- `chart-proxy`: emits `chart_proxy`

## Stream Endpoint

Refresh-service exposes SSE:

```
GET /ops/events?tail=200
Authorization: Bearer <firebase-id-token>
```

Notes:
- `tail` controls how many historical events are sent before the live stream.
- The endpoint uses `REDIS_URL` and `REDIS_PREFIX` to locate `pipeline_events`.

## Env Flags

- `PIPELINE_EVENTS_ENABLED` (default: true)
- `PIPELINE_EVENTS_STREAM` (optional override)
- `PIPELINE_EVENTS_MAXLEN` (stream retention)
- `PIPELINE_EVENTS_RUN_ENV` (default: prod)
- `PIPELINE_EVENTS_SAMPLE_RATE` (symbol-level sampling, default: 0.15)

## UI Consumption

The UI subscribes to `/ops/events`, maintains a rolling buffer of events, and:
- animates trains per `batchId`
- updates station status (active/ok/error)
- surfaces origins and provider activity in drilldowns
- batch drilldown shows sampled symbols and per-symbol event timeline
- symbol drilldown shows scoring (score/action/hold/SL/TP), bot signal summary, and IO metadata

## Discovery Artifacts

- `docs/ops-subway/DATA_INVENTORY.md` (Firestore + Redis + provider inventory)
- `docs/ops-subway/DISCOVERY_REPORT.md` (runtime discovery output; redacted)
- `scripts/ops-subway/discover.mjs` (generates `docs/ops-subway/DISCOVERY_REPORT.md`)
- `scripts/ops-subway/check-sse.mjs` (verifies `/ops/events` tail counts)
- `scripts/ops-subway/capture-subway.mjs` (captures a live /ops/subway screenshot)

## Verification Checklist

- [ ] `pipeline_events` stream receives events from core services.
- [ ] `/ops/events` streams SSE when called with a valid Firebase ID token.
- [ ] `/ops/subway` renders trains within 1-2 batches.
- [ ] Provider stations light up when MDG calls vendors.
- [ ] Batch drilldown shows origins breakdown.
- [ ] Symbol drilldown shows origins + scoring + bot signal summary.
- [ ] Bot events include `meta.tradingMode` (paper/dry-run expected).

Screenshots/recording: add artifacts under `docs/ops-subway/` when verified.
