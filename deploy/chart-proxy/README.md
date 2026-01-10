# Chart Proxy (Firebase Cloud Function)

Proxy for the market data gateway to handle CORS for chart candles.

## Deployment

### Option 1: Firebase Functions (Recommended)

```bash
cd deploy/chart-proxy
npm install

# Deploy using Firebase Functions
firebase deploy --only functions:chartProxy
```

### Option 2: Manual Deployment

```bash
cd deploy/chart-proxy
firebase deploy --only functions:chartProxy
```

## Configuration

The function reads the market data gateway URL from:
- Environment variable: `MARKET_DATA_GATEWAY_URL`

## Frontend Configuration

After deploying, set the proxy URL in your frontend `.env`:

```bash
VITE_CHART_PROXY_URL=https://YOUR-REGION-YOUR-PROJECT.cloudfunctions.net/chartProxy
```

To find your function URL:
```bash
firebase functions:list
# Or check Firebase Console → Functions
```

## API Endpoints

### GET /chartProxy

Query parameters:
- `symbol` (required): Asset symbol (e.g., "AAPL", "EURUSD")
- `assetClass` (optional): Asset class - "stock", "forex", or "crypto" (default: "stock")
- `interval` (optional): Time interval - "1min", "5min", "15min", "30min", "1h", "4h", "1day", "1week" (default: "15min")

Response:
```json
{
  "series": {
    "2024-01-01 10:00:00": {
      "1. open": "100.0",
      "2. high": "105.0",
      "3. low": "99.0",
      "4. close": "103.0",
      "5. volume": "1000000"
    },
    ...
  },
  "seriesKey": "FMP 15min"
}
```

## Error Handling

The proxy forwards gateway errors and missing configuration errors.

All errors are returned as JSON with an `error` field.
