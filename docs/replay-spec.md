# Replay Mode Specification (Design Lock)

This document freezes the replay-mode design. It is design-only. No code is implied.

## Goals
- Deterministic replay for swing and pre-breakout testing outside market hours.
- No live data pollution, no vendor calls in replay, no split-brain switching.
- Additive-only storage for replay runs.

## Non-Negotiable Invariants
- Live keys remain unchanged.
- Replay writes never touch `market/*`.
- Replay never calls vendors.
- Replay time uses `controls.asOf` only.
- Cache keys always include `{mode}:{runId}:{sessionId}`.

## Control Plane (Authoritative)
Firestore: `replay/controls`
```
desiredMode: "live" | "replay"
phase: "switching" | "ready" | "running" | "paused" | "stopping" | "error"
activeRunId: string
datasetId: string
asOf: timestamp
speedScript: [{ startTs, endTs, speed } | { type: "jump", toTs }]
version: number
sessionId: uuid
requiredServices: ["mdg","price-streamer","market-intel","signal-evaluator","ui","chart-proxy?"]
botsReplayEnabled: false
```

### Field ownership (explicit)
- Replay Controller writes: desiredMode, phase, activeRunId, datasetId, speedScript, requiredServices, sessionId, version, botsReplayEnabled.
- Replay Streamer writes: asOf (while phase is running or paused).
- All other services are read-only for controls.

### SessionId semantics
- sessionId changes on every replay run start.
- Services must reject stale ACKs (sessionId + version must match).

## Replay Run Storage (Additive)
Firestore:
```
replay/runs/{runId}
replay/runs/{runId}/configSnapshot
replay/runs/{runId}/market/*
replay/runs/{runId}/symbolMap/{legacyKey}
replay/consumers/{serviceName}
```

GCS:
```
gs://<bucket>/replay/tapes/stocks/{tapeDate}/{symbolKeyV2}.bars.1m.json.gz
gs://<bucket>/replay/tapes/stocks/{tapeDate}/{symbolKeyV2}.bars.1d.json.gz
gs://<bucket>/replay/tapes/profile/{symbolKeyV2}.json
gs://<bucket>/replay/tapes/news/{tapeDate}/by_symbol/{symbolKeyV2}.json.gz
gs://<bucket>/replay/tapes/stocks/{tapeDate}/manifest.json
gs://<bucket>/replay/runs/{runId}/resolved_symbols.json
```

## Manifest Discovery (No Guessing)
Manifest is located via:
```
runId -> datasetId -> manifest path
```
No hardcoded date guessing is allowed.

## tapeDate Derivation
```
tapeDate = sessionDate(asOf, manifest.timezone/open/close)
```
All `{YYYY-MM-DD}` tape paths use tapeDate only.

## Symbol Keying
### Live (unchanged)
Legacy key:
```
legacyKey = "{assetClass}:{normalizedSymbol}"
```
No venue included.

### Replay (V2 only)
```
symbolKeyV2 = "{assetClass}:{venue}:{normalizedSymbol}"
```
Replay tapes use symbolKeyV2 only.

### Legacy -> V2 Mapping (required for every replay request)
- Resolve legacyKey -> symbolKeyV2 via manifest-backed mapping.
- Firestore debug mapping:
  ```
  replay/runs/{runId}/symbolMap/{legacyKey}
  ```

### TSX suffix mapping (locked)
Suffix to exchangeMeta:
- .TO, .TSX -> TSX
- .TSXV, .V -> TSXV

Venue inference (replay only):
1) If suffix matches TSX table -> venue=CA
2) Else if exchangeHint exists:
   - TSX/TSXV -> venue=CA
   - NASDAQ/NYSE/AMEX -> venue=US
   - else -> venue=US
3) Else venue=US

symbolKeyV2 normalization:
- Strip TSX suffix from normalizedSymbol (store rawSymbol separately).
  Example: SHOP.TO -> stock:CA:SHOP

## Manifest Contract (Required Fields)
```
timezone
coverage: "RTH" | "RTH+EXT" | "FULL"
openTime, closeTime, extOpenTime?, extCloseTime?
symbols[]
symbolMap: legacyKey -> symbolKeyV2
artifacts per symbol: { bars1m, bars1d, profile, news }
buildTs
provider metadata
missingSymbols[]
```

## Out-of-Coverage Behavior
If asOf is outside coverage window or before first bar:
```
code: "REPLAY_OUT_OF_COVERAGE"
legacyKey
symbolKeyV2
tapeDate
coverageWindow
asOf
runId
```
Quote endpoints return last known <= asOf plus meta.outOfCoverage=true.

## Error Payload (Missing Tape)
```
code: "REPLAY_TAPE_MISSING"
legacyKey
symbolKeyV2
artifact
tapeDate
runId
```

## Replay Endpoint Mapping (MDG)
All replay endpoints must:
1) resolve legacyKey -> symbolKeyV2 using manifest
2) use tapeDate for paths

### GET /v1/fmp/quote?symbolKey=...
- Source: 1m bars (symbolKeyV2).
- Filter: last bar where t <= asOf.
- Missing: REPLAY_TAPE_MISSING.
- Cache key includes mode/runId/sessionId + asOf bucket.

### GET /v1/fmp/candles?symbolKey=...&interval=1m&fromTs&toTs
- Source: 1m bars.
- Filter: t in [fromTs,toTs], cap at asOf.
- Missing: REPLAY_TAPE_MISSING.

### GET /v1/fmp/candles?symbolKey=...&interval=1day (daily)
- Source: 1d bars.
- Filter: include dates < sessionDate; include sessionDate only if asOf >= closeTime.
- Missing: REPLAY_TAPE_MISSING or REPLAY_RANGE_INCOMPLETE.

### GET /v1/fmp/profile?symbolKey=...
- Source: profile/{symbolKeyV2}.json.
- Missing: REPLAY_TAPE_MISSING.

### GET /v1/fmp/news?symbolKey=...&lookbackHours=N
- Source: news/by_symbol/{symbolKeyV2}.json.gz.
- Filter: publishedAt <= asOf; publishedAt >= asOf - N hours.
- Missing: REPLAY_TAPE_MISSING.
- Raw news fallback allowed only at dataset-build time, never at runtime.

### GET /v1/movers?scope=...&window=15m (if present)
- Source: replay Redis hot quotes or 1m tape at asOf.
- Missing: exclude symbol, record meta.missingSymbols.

## Replay Build Endpoint (Dataset Prep Only)
POST /replay/buildTape?date=YYYY-MM-DD&symbols=...
- Allowed to call vendors.
- Writes only to GCS tape + manifest.
- Never writes to market/*.
- Returns okSymbols, missingSymbols, artifactsBuilt, errors.
- Enforces maxSymbols, concurrency, and backoff.

## Replay Switch Blocking Checklist (Pass/Fail)
- No writes to market/* when desiredMode=replay.
- No vendor calls in replay.
- Cache keys always include mode/runId/sessionId.
- UI shows replay banner everywhere and disables live actions.
- All requiredServices ACK same sessionId+version.
- Seek clears replay Redis and resets pointers.
- Replay wallet path is used.
- maxSymbols enforced or sharded outputs.

## Discovered at Runtime (No Assumptions)
Discovery is read-only and includes:
- Static code inventory of all read/write paths.
- Runtime instrumentation in write-guard wrappers (logs attempted paths).
- Runtime instrumentation in read wrappers (sampled read paths).
- Unknown keys are only added after validation and allowlisting.

## Replay Wallet Isolation
Replay auto-paper writes to:
```
users/{uid}/paper_replay/{runId}/...
```
Never writes to live paper wallet.

## Event Stream Tagging
All replay events include:
```
runEnv: "replay"
runId
sessionId
controlsVersion
```
Ops views filter by runEnv by default.
