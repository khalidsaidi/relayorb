# RelayOrb

Private control deck for monitoring and commanding multiple trading-bot frameworks through a unified Firestore schema.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure Firebase web credentials:
   ```bash
   cp .env.example .env
   ```
   Fill values from Firebase Console → Project settings → Your apps → Web app config.
3. Lock down the admin allowlist:
   - `src/config/allowlist.ts`
   - `firestore.rules`
4. Run the app:
   ```bash
   npm run dev
   ```

## Firestore Schema

- `bots/{botId}`: metadata + status + heartbeat + summary + desiredConfig + capabilities
- `bots/{botId}/events/{eventId}`: normalized event stream
- `bots/{botId}/signals/{signalId}`: trading signal feed
- `bots/{botId}/commands/{commandId}`: command queue from UI

## Hot Data Store

For live prices and 15-minute movers, Redis is used as the hot store when `REDIS_URL` is configured.
Firestore remains the latest-state store for UI subscriptions and configs.

## Commands

The UI queues commands with:

- `type`: `start | stop | restart | backtest | paper | live | reload_config | configure`
- `payload`: optional JSON
- `status`: `queued` initially

Adapters should update command status as they execute.

## Engine Config
The bot detail screen includes a full engine config JSON editor per bot. Saved configs are stored in Firestore and applied by the agent (when config sync is enabled on the bot host).

## Firebase Rules

Rules are configured to allow access only for the email allowlist. Update both the app allowlist and `firestore.rules` to match.

## Deploy

```bash
npm run build
firebase deploy --only hosting
```

Remember to run `firebase deploy --only firestore:rules` after updating `firestore.rules`.

## Signal Evaluation

The signal evaluator worker scores bot signals against real market outcomes and writes
accuracy metrics to `analytics/signalPerformance` for the dashboard.

- Source: `deploy/signal-evaluator`
- Requires `MARKET_DATA_GATEWAY_URL` for centralized market data.

## Manual Refresh

The Dashboard includes a "Refresh now" button to trigger the market-intel and
signal-evaluator jobs on demand. Deploy the refresh service and set:

- `VITE_REFRESH_URL` → Cloud Run URL from `deploy/refresh-service`.

## Client Market Data

The UI uses the Market Data Gateway for charts, quotes, and search (no direct vendor calls).
Set:

- `VITE_MARKET_DATA_GATEWAY_URL` → Cloud Run URL from `deploy/market-data-gateway`.
