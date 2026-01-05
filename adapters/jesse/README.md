# Jesse Adapter (stub)

Implement an adapter that translates Jesse's telemetry into RelayOrb.

Suggested flow:
- Capture strategy run status and performance metrics.
- Emit heartbeats and events into Firestore.
- Listen for command queue updates for live/paper/backtest flows.
