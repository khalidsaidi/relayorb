# RelayOrb Agent

The RelayOrb agent runs alongside your bots and bridges bot APIs to Firestore. It polls bot status/events and executes commands written by the RelayOrb UI.

## What it does
- Updates `bots/{botId}` with status, heartbeat, and state.
- Writes normalized events to `bots/{botId}/events`.
- Writes normalized signals to `bots/{botId}/signals` when adapters emit them.
- Watches `bots/{botId}/commands` and executes queued commands.

## Config
Copy `config.example.json` to `config.json` and fill credentials.

```bash
cp config.example.json config.json
```

Key fields:
- `bots[].id`: Firestore bot document ID.
- `bots[].engine`: `freqtrade | backtrader | alpaca | oanda`.
- `bots[].api.baseUrl`: Bot API base URL.
- `bots[].api.username/password`: Auth credentials where required.
- `bots[].desiredConfig`: Seed trading universe config (mode, exchange, pairs, timeframe).
- `bots[].desiredConfig.strategy`: Optional strategy identifier.
- `bots[].desiredConfig.risk`: Optional guardrails (maxPositionSize, maxDailyLoss, maxOpenOrders, maxLeverage).
- `bots[].desiredConfig.advanced`: Free-form JSON payload passed to configure commands.
- `bots[].capabilities`: Supported exchanges/timeframes/modes for UI pickers.

## Auth
The agent uses Firebase Admin credentials. Provide one of:
- `GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json`, or
- Run on GCP with an attached service account that has Firestore access.

Optional config sync env vars:
- `RELAYORB_FREQTRADE_CONFIG` path to `config.json`

Event-triggered scans (optional):
- `REDIS_URL` to subscribe to market-intel batch events.
- `REDIS_PREFIX` (default: relayorb).
- `RELAYORB_EVENT_CHANNEL` (default: `<prefix>:events`).
- `RELAYORB_EVENT_AUTO_SCAN` (default: true; set false to disable).
- `RELAYORB_EVENT_BATCH_LIMIT` (default: 25 symbols per asset class).
- `RELAYORB_EVENT_DEBOUNCE_MS` (default: 60000).
- Per-bot overrides: `eventTrigger` (bool) and `eventCommand` (`scan` or `analyze`).
- Optional run tagging: `RELAYORB_RUN_ID` or `RUN_ID`.
- Batch fallback (durable) polling:
  - `RELAYORB_BATCH_COLLECTION` (default: `batches`).
  - `RELAYORB_BATCH_CONSUMER_ID` (default: `agent`).
  - `RELAYORB_BATCH_POLL_ENABLED` (default: true).
  - `RELAYORB_BATCH_POLL_INTERVAL_MS` (default: 60000).
  - `RELAYORB_BATCH_POLL_LIMIT` (default: 3).

## Run locally
```bash
npm install
npm run start
```

## Command payloads
Some commands require payloads. Examples:

The agent passes payloads through to the underlying bot APIs.

### Configure universe
Use the `configure` command type (from the UI) to apply the current desired config.
Adapters that cannot apply config return a note and keep the desired config stored in Firestore.

When config sync env vars are set, the agent will also translate and write bot-specific config files:
- Freqtrade: updates the JSON config and reloads it
