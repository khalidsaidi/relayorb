# Backtrader Service

REST API wrapper for Backtrader trading framework. Runs on the VM alongside Freqtrade.

## Features

- **Multi-asset**: Stocks and Forex
- **Technical Analysis**: RSI + SMA indicators
- **Data Sources**: FMP (primary) with Alpha Vantage fallback
- **Signal Generation**: Automatic buy/sell signals based on technical indicators

## Setup

1. **Environment Variables** (add to docker-compose.yml or .env):
```bash
FMP_API_KEY=your_key_here
ALPHAVANTAGE_API_KEY=optional_fallback_key
```

2. **Build and Start**:
```bash
cd deploy/bot-host
docker compose build backtrader
docker compose up -d backtrader
```

## Configuration

Add to `agent-config/config.json`:
```json
{
  "id": "backtrader-stocks",
  "engine": "backtrader",
  "api": {
    "baseUrl": "http://backtrader:8080"
  },
  "desiredConfig": {
    "symbols": ["AAPL", "MSFT", "NVDA"],
    "assetClass": "stock",
    "timeframe": "15m"
  }
}
```

## How It Works

1. Agent polls `/signals` endpoint
2. Backtrader runs strategies on configured symbols
3. Strategies generate signals (RSI oversold/overbought + SMA crossovers)
4. Signals are written to Firestore via agent
5. Market-intel aggregates signals with other bots

## Limitations

- Strategy runs on-demand, not continuously
- FMP rate limits apply to large symbol lists
