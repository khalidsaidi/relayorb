# Ops Graph Validation

Run timestamp: 2026-01-12T01:10:40Z

Evidence:
- Screenshot: `docs/ops-graph/ops-graph-20260112-010836.png`
- Recording: `docs/ops-graph/ops-graph-20260112-010840.webm`

SSE tail summary (last ~500 events):
- Present edges: `price_streamer->redis`, `price_streamer->market_data_gateway`, `market_data_gateway->provider:fmp`, `redis->market_intel`, `market_intel->movers_15m`, `movers_15m->candidates_merge`, `candidates_merge->firestore`, `market_intel->new_batch`, `new_batch->relayorb_agent`, `new_batch->refresh_service`, `refresh_service->signal_evaluator`, `relayorb_agent->bot_engine:freqtrade`, `relayorb_agent->bot_engine:backtrader`, `relayorb_agent->bot_signals`, `signal_evaluator->market_data_gateway`, `signal_evaluator->firestore`, `signal_evaluator->signal_performance`.
- Not seen in this tail: `market_data_gateway->provider:marketaux` (edge exists), `firestore->ui` pulse (edge exists; likely low frequency).

Validation checklist:
YES/NO after redeploys + freeze capture:
- A) Price source visible (PS inbound edge to provider/MDG): YES — PS→MDG + MDG→FMP present.
- B) PS -> Redis WRITE pulses: YES.
- C) Redis -> MI READ and MI -> Movers chain: YES — `redis->market_intel`, `market_intel->movers_15m`, `movers_15m->candidates_merge`.
- D) MI -> Firestore WRITE visible: YES — `candidates_merge->firestore`.
- E) MI -> Redis Stream:new_batch publish visible: YES.
- F) Stream -> AG and Stream -> REF consume edges visible: YES.
- G) Stream node shows head + AG lag + REF lag badges: YES.
- H) REF -> SE TRIGGER visible: YES.
- I) Bots explicit (Freqtrade/Backtrader) with AG run edges: YES — freqtrade + backtrader present.
- J) Bot outputs visible (AG -> Firestore bot signals): YES.
- K) SE is clearly the scorer (no ambiguous scoring nodes): YES.
- L) SE input merge shows FS/Redis reads + provider calls + FS write: YES — `signal_evaluator->market_data_gateway` present; FS/Redis reads and write present.
- M) Candidates Merge shows provenance breakdown: YES — originsBreakdown + badges; no unknown.

Notes:
- Provider:marketaux not observed in this tail (edge exists; may require traffic).
- Firestore->UI pulse not observed in this tail (edge exists; low frequency).
