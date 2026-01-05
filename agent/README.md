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
- `bots[].engine`: `freqtrade | hummingbot | jesse`.
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
- `RELAYORB_HUMMINGBOT_DIR` path to hummingbot bots directory
- `RELAYORB_JESSE_DIR` path to the Jesse project directory

## Run locally
```bash
npm install
npm run start
```

## Command payloads
Some commands require payloads. Examples:

### Jesse live/paper
```json
{
  "id": "session-1",
  "exchange": "Binance",
  "exchange_api_key_id": "<id>",
  "notification_api_key_id": "<id>",
  "routes": [{ "exchange": "Binance", "symbol": "BTC-USDT", "timeframe": "1m", "strategy": "MyStrategy" }],
  "data_routes": [],
  "config": {},
  "debug_mode": false
}
```

### Jesse backtest
```json
{
  "id": "backtest-1",
  "exchange": "Binance",
  "routes": [{ "exchange": "Binance", "symbol": "BTC-USDT", "timeframe": "1m", "strategy": "MyStrategy" }],
  "data_routes": [],
  "config": {},
  "start_date": "2023-01-01",
  "finish_date": "2023-02-01",
  "debug_mode": false,
  "export_csv": false,
  "export_json": false,
  "export_chart": false,
  "export_tradingview": false,
  "fast_mode": true,
  "benchmark": false
}
```

### Hummingbot backtest (example)
```json
{
  "strategy": "<strategy>",
  "config": {}
}
```

The agent passes payloads through to the underlying bot APIs.

### Configure universe
Use the `configure` command type (from the UI) to apply the current desired config.
Adapters that cannot apply config return a note and keep the desired config stored in Firestore.

When config sync env vars are set, the agent will also translate and write bot-specific config files:
- Freqtrade: updates the JSON config and reloads it
- Hummingbot: writes a `conf.yml` in the bot folder and sends a config payload to the API
- Jesse: writes `config/routes.json` and `config/config.json`
