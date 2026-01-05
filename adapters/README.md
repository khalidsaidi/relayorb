# RelayOrb Adapters

Adapters translate bot-specific APIs into the unified Firestore schema used by the RelayOrb UI.
Each adapter should:

- Publish bot metadata to `bots/{botId}`
- Stream normalized events to `bots/{botId}/events/{eventId}`
- Listen for UI commands in `bots/{botId}/commands/{commandId}`
- Acknowledge command status updates (queued -> running -> completed/failed)

## Expected Collections

- `bots/{botId}`
  - `engine` (freqtrade, hummingbot, jesse)
  - `status` (online/offline/error/idle)
  - `lastHeartbeat`
  - `summary` (positions, orders, pnl)
  - `state` (optional full snapshot)

- `bots/{botId}/events/{eventId}`
  - `createdAt`
  - `type`
  - `severity`
  - `message`
  - `data`

- `bots/{botId}/commands/{commandId}`
  - `type`
  - `payload`
  - `createdAt`
  - `status`
  - `requestedBy`

Each adapter folder contains a stub README you can replace with real implementation details.
