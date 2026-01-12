# Ops Graph Verification

Date: 2026-01-11
Environment: prod
Stream: pipeline_events

## Checklist

- PS -> Redis writes pulse (price_streamer->redis).
- MI reads Redis (redis->market_intel) and writes candidates (candidates_merge->firestore).
- new_batch publish/consume edges pulse (market_intel->new_batch, new_batch->refresh_service, new_batch->relayorb_agent).
- Refresh triggers SE (refresh_service->signal_evaluator).
- Bot signals written (relayorb_agent->bot_signals).
- Bot signals written to Firestore (bot_signals->firestore).
- SE reads Redis (redis->signal_evaluator) and Firestore (firestore->signal_evaluator).
- SE writes performance (signal_evaluator->signal_performance).
- SE writes analytics to Firestore (signal_evaluator->firestore).
- Provider calls visible per providerId (market_data_gateway->provider:*).
- Origins visible on sampled symbols.
- new_batch head + consumer lags visible.
- No secrets in events (paramsHash only).

## Evidence

- Screenshot: docs/ops-graph/ops-graph-20260111-194029.png
- Recording: docs/ops-graph/ops-graph-20260111-194035.webm

## Notes

- Gaps observed:
- Follow-ups:
  - Confirm SE -> Firestore write edges once the new signal-evaluator job run completes.
  - Monitor relayorb-agent update command completion in bots/*/commands.
