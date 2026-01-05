# Freqtrade Adapter (stub)

Implement an adapter that bridges Freqtrade's REST/WebSocket APIs to RelayOrb.

Suggested flow:
- Poll `/api/v1/status` for heartbeat updates.
- Push trade/order events into `bots/{botId}/events`.
- Listen for commands and call Freqtrade endpoints (start/stop/restart/backtest).
