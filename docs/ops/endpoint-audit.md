# Endpoint Audit

## App Routes
- GET /orb (ORB robot control page)

## orb-runner (Cloud Run)
- GET /health (service heartbeat + session info)
- POST /run (manual ORB cycle trigger)

## Market Data Gateway (used by orb-runner)
- GET /clock
- GET /v1/market/most-actives?limit=...
- GET /v1/market/quote?symbol=...&assetClass=stock
- GET /v1/market/candles?symbol=...&assetClass=stock&interval=1min&limit=...
- GET /replay/runs
- POST /replay/runs
- GET /replay/tapeSymbols?datasetId=...

## Firestore Docs (used by orb-runner + UI)
- orbControls/{brokerAccountKey} (strategyProfile)
- orbStates/{brokerAccountKey} (orbRange, snapshot, status)
- executionRequests/{id} (source=orb, strategy=orb_universe|orb_single_symbol)
- brokerAccountSummaries/{brokerAccountKey}
- brokerPositions (filtered by brokerAccountKey)
- brokerAccounts/{brokerAccountKey}
- trading/controls
