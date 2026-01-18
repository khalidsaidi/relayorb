# Replay Mode Spec (Stocks)

Status: frozen
Scope: live/replay mode switching + MDG replay tape reads + UI replay visibility

## Goals
- Replay is deterministic and never contaminates live data.
- Replay uses controls.asOf as the single time source.
- All replay outputs are run-scoped and additive.
- No vendor calls while replay is active.

## Control Plane
Firestore: `replay/controls`

Fields:
- desiredMode: "live" | "replay"
- phase: "switching" | "ready" | "running" | "paused" | "stopping" | "error"
- activeRunId: string
- datasetId: string
- sessionId: string (changes on each run start)
- version: number (increments per control change)
- asOf: timestamp (authoritative replay time)
- requiredServices: string[]

ACKs:
`replay/controls/consumers/{service}`
- service, effectiveMode, sessionId, seenControlsVersion, activeRunId, phase, datasetId, heartbeatAt

## Namespaces (Additive-Only)
Live:
- Firestore: `market/*`
- Redis: `{prefix}:*`

Replay:
- Firestore: `replay/controls/runs/{runId}/market/*`
- Redis: `replay:{runId}:*`
- Replay outputs are always run-scoped.

## Symbol Key Mapping (Legacy -> V2)
Live system uses `legacyKey = assetClass:normalizedSymbol`.
Replay tapes use `symbolKeyV2 = assetClass:venue:normalizedSymbol`.

Resolution (manifest-backed):
- All replay requests resolve legacyKey -> symbolKeyV2 using manifest mapping.
- Replay requests are rejected if mapping is missing.

Venue inference (deterministic):
- If raw symbol ends with TSX suffix (.TO/.TSX/.TSXV/.V): venue=CA
  - suffix mapping table:
    - .TO/.TSX -> TSX
    - .TSXV/.V -> TSXV
- Else if exchangeHint/snapshot exchange exists:
  - TSX/TSXV -> CA
  - NASDAQ/NYSE/AMEX -> US
  - else default US
- Else default US

Normalization:
- For symbolKeyV2, strip TSX suffix from normalizedSymbol.
- Keep rawSymbol and exchange meta in manifest.

Debug mapping:
- `replay/controls/runs/{runId}/symbolMap/{legacyKey}`

## Tape Date Derivation
`tapeDate = sessionDate(asOf, manifest.timezone/open/close)`
All `{YYYY-MM-DD}` paths use tapeDate.

## Manifest Discovery
Replay run metadata provides manifest path:
`replay/controls/runs/{runId}` -> { datasetId, manifestPath }
No hardcoded date guessing.

Manifest must include:
- timezone
- coverage: "RTH" | "RTH+EXT" | "FULL"
- openTime, closeTime, extOpenTime/extCloseTime (optional)
- symbols[]
- per-symbol artifacts: { bars1m, bars1d, profile, news }
- buildTs
- provider metadata
- missingSymbols[]

## Out-of-Coverage Behavior
If asOf is outside manifest coverage window or before first bar:
- return error code `REPLAY_OUT_OF_COVERAGE`
- include: legacyKey, symbolKeyV2, tapeDate, runId, asOf, coverageWindow

## Errors (Replay)
All replay errors are explicit and include:
- legacyKey
- symbolKeyV2
- artifact
- tapeDate
- runId

Error codes:
- REPLAY_TAPE_MISSING
- REPLAY_OUT_OF_COVERAGE
- REPLAY_UNSUPPORTED

## Endpoint -> Artifact Mapping (Replay)
Global rules:
- Time source: controls.asOf ONLY
- No vendor calls ever
- No fallback to live
- Cache keys include: mode + runId + sessionId (+ asOfBucket when needed)

Artifacts (GCS):
- 1m bars: .../tapes/stocks/{tapeDate}/{symbolKeyV2}.bars.1m.json.gz
- 1d bars: .../tapes/stocks/{tapeDate}/{symbolKeyV2}.bars.1d.json.gz
- profile:  .../tapes/profile/{symbolKeyV2}.json
- news raw: .../tapes/news/{tapeDate}/marketaux.json.gz
- news by_symbol index (preferred): .../tapes/news/{tapeDate}/by_symbol/{symbolKeyV2}.json.gz
- manifest: .../tapes/stocks/{datasetId}/manifest.json

1) GET /v1/quote?symbolKey=...
- Source: bars.1m
- Return last bar where bar.t <= asOf (bar.c)
- Missing: REPLAY_TAPE_MISSING

2) GET /v1/candles?symbolKey=...&interval=1m&fromTs&toTs
- Source: bars.1m
- Return bars in [fromTs,toTs] capped at asOf
- Missing: REPLAY_TAPE_MISSING

3) GET /v1/daily?symbolKey=...&range=...
- Source: bars.1d
- Include daily bars where date < sessionDate(asOf)
- Include current sessionDate bar only if asOf >= closeTime
- Missing: REPLAY_TAPE_MISSING / REPLAY_RANGE_INCOMPLETE

4) GET /v1/profile?symbolKey=...
- Source: profile
- Missing: REPLAY_TAPE_MISSING

5) GET /v1/news?symbolKey=...&lookbackHours=N
- Source: by_symbol index (preferred)
- Fallback to raw marketaux is allowed only at dataset build time (not at runtime)
- Filter: publishedAt <= asOf AND >= asOf - N hours
- Missing artifact: REPLAY_TAPE_MISSING

6) GET /v1/movers?scope=universe|trending|all&window=15m
- Source: replay Redis hot quotes/candles OR bars.1m
- Compute change between asOf and asOf-15m
- Missing symbol prices: exclude and report in meta.missingSymbols

7) POST /replay/buildTape?date=YYYY-MM-DD&symbols=...
- Vendor calls allowed (FMP/Marketaux)
- Writes only GCS artifacts + manifest
- Never writes to market/*
- Returns: okSymbols, missingSymbols, artifactsBuilt, errors[]

## Cache Isolation
Cache keys include:
- mode
- runId
- sessionId
- endpoint/paramsHash
- asOfBucket when relevant

## Vendor Hard Block
MDG replay mode never calls vendors.
Missing data always returns explicit replay error.
