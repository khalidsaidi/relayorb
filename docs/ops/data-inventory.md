# Data Inventory
Generated at 2026-01-12T01:52:22.519Z

Project: relayorb

Collections:
- analytics
- batch_consumers
- batches
- bots
- e2e_runs
- market
- market_snapshots_fx
- market_snapshots_us
- market_symbols_stocks
- presence
- users

Sampled Documents:
- market/movers (found)
  - fields: windowMinutes, markets, meta, updatedAt
  - sample:
    
    ```json
    {
      "windowMinutes": "<number>",
      "markets": {
        "us": "<map>",
        "forex": "<map>"
      },
      "meta": {
        "sources": "<map>",
        "runId": "<string>"
      },
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/candidates (found)
  - fields: meta, runId, batchId, items, updatedAt
  - sample:
    
    ```json
    {
      "meta": {
        "counts": "<map>",
        "limit": "<number>",
        "sources": "<map>",
        "count": "<number>",
        "runId": "<string>"
      },
      "runId": "<string>",
      "batchId": "<string>",
      "items": "array(len=1)",
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/hotTrades (found)
  - fields: sources, meta, items, updatedAt
  - sample:
    
    ```json
    {
      "sources": {
        "forex": "<string>",
        "stocks": "<string>",
        "crypto": "<string>"
      },
      "meta": {
        "signalLookbackMinutes": "<number>",
        "accuracyHorizon": "<string>",
        "botWeightCount": "<number>",
        "signalWeight": "<number>",
        "accuracyHitRate": null,
        "accuracySignals": null,
        "llmEnabled": "<boolean>",
        "llmIntervalMinutes": "<number>"
      },
      "items": "array(len=1)",
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/trending (found)
  - fields: horizons, weights, meta, byHorizon, updatedAt
  - sample:
    
    ```json
    {
      "horizons": "array(len=4)",
      "weights": {
        "consensus": "<number>",
        "news": "<number>",
        "liquidity": "<number>",
        "momentum": "<number>"
      },
      "meta": {
        "defaultHorizon": "<string>",
        "trendLimit": "<number>",
        "signalLookbackMinutes": "<number>",
        "newsEnabled": "<boolean>",
        "newsIntervalMinutes": "<number>",
        "newsUpdatedAt": null,
        "runId": "<string>"
      },
      "byHorizon": {
        "24h": "<map>",
        "1h": "<map>",
        "15m": "<map>",
        "7d": "<map>"
      },
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/actionBoard (found)
  - fields: buys, sells, meta, byAsset, updatedAt
  - sample:
    
    ```json
    {
      "buys": "array(len=0)",
      "sells": "array(len=1)",
      "meta": {
        "horizon": "<string>",
        "limit": "<number>",
        "signalLookbackMinutes": "<number>",
        "classLimit": "<number>",
        "accuracyHorizon": "<string>",
        "botWeightCount": "<number>",
        "signalWeight": "<number>",
        "accuracyHitRate": null
      },
      "byAsset": {
        "buys": "<map>",
        "sells": "<map>"
      },
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/popular (found)
  - fields: meta, items, updatedAt
  - sample:
    
    ```json
    {
      "meta": {
        "perClass": "<number>",
        "runId": "<string>"
      },
      "items": "array(len=1)",
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/prices (found)
  - fields: meta, items, updatedAt
  - sample:
    
    ```json
    {
      "meta": {
        "sources": "<map>",
        "count": "<number>",
        "runId": "<string>",
        "watchlist": "<map>"
      },
      "items": "array(len=1)",
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/prices_snapshot (found)
  - fields: meta, items, updatedAt
  - sample:
    
    ```json
    {
      "meta": {
        "count": "<number>",
        "runId": "<string>"
      },
      "items": "array(len=1)",
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/universe (found)
  - fields: mode, forex, stocks, crypto, updatedAt
  - sample:
    
    ```json
    {
      "mode": "<string>",
      "forex": {
        "includeTrending": "<boolean>",
        "mode": "<string>",
        "pairs": "array(len=0)"
      },
      "stocks": {
        "includeTrending": "<boolean>",
        "mode": "<string>",
        "symbols": "array(len=2)"
      },
      "crypto": {
        "includeTrending": "<boolean>",
        "mode": "<string>",
        "symbols": "array(len=0)"
      },
      "updatedAt": {
        "_nanoseconds": "<number>",
        "_seconds": "<number>"
      }
    }
    ```
    
- market/controls (found)
  - fields: riskProfile, assetFocus, dipHorizon, primaryAssets, autoTuneIntervalHours, autoTuneWithAI, autoTuneEnabled, trendHorizon, autoTuneHorizon, autoTuneSignals, autoTuneLastAt, autoTuneNotes
  - sample:
    
    ```json
    {
      "riskProfile": "<string>",
      "assetFocus": "array(len=3)",
      "dipHorizon": "<string>",
      "primaryAssets": {
        "forex": "array(len=0)",
        "stocks": "array(len=0)",
        "crypto": "array(len=0)"
      },
      "autoTuneIntervalHours": "<number>",
      "autoTuneWithAI": "<boolean>",
      "autoTuneEnabled": "<boolean>",
      "trendHorizon": "<string>",
      "autoTuneHorizon": "<string>",
      "autoTuneSignals": "<number>",
      "autoTuneLastAt": "<timestamp>",
      "autoTuneNotes": "<string>"
    }
    ```
    
- market/streamSymbols (found)
  - fields: sources, updatedAt
  - sample:
    
    ```json
    {
      "sources": {
        "trade-now": "<map>",
        "dashboard": "<map>"
      },
      "updatedAt": "<timestamp>"
    }
    ```
    
- market/refresh (found)
  - fields: requestedBy, requestedAt, requestId, jobs
  - sample:
    
    ```json
    {
      "requestedBy": {
        "uid": "<string>",
        "email": "<string>"
      },
      "requestedAt": "<timestamp>",
      "requestId": "<string>",
      "jobs": "array(len=2)"
    }
    ```
    
- batches/* (found)
  - fields: createdAt, sources, counts, count, runId, batchId, items, docPath, updatedAt
  - sample:
    
    ```json
    {
      "createdAt": "<timestamp>",
      "sources": {
        "forex": "<string>",
        "stocks": "<string>",
        "crypto": "<string>"
      },
      "counts": {
        "stock": "<number>",
        "forex": "<number>",
        "crypto": "<number>"
      },
      "count": "<number>",
      "runId": "<string>",
      "batchId": "<string>",
      "items": "array(len=1)",
      "docPath": "<string>",
      "updatedAt": "<timestamp>"
    }
    ```
    
- batch_consumers/* (found)
  - fields: runId, lastProcessedAt, lastBatchId, updatedAt
  - sample:
    
    ```json
    {
      "runId": null,
      "lastProcessedAt": "<timestamp>",
      "lastBatchId": "<string>",
      "updatedAt": "<timestamp>"
    }
    ```
    
- analytics/signalPerformance (found)
  - fields: horizons, bottomSymbols, topSymbols, topBots, overall, byAsset, meta, updatedAt
  - sample:
    
    ```json
    {
      "horizons": "array(len=3)",
      "bottomSymbols": {
        "24h": "array(len=0)",
        "7d": "array(len=0)",
        "1h": "array(len=0)"
      },
      "topSymbols": {
        "24h": "array(len=0)",
        "7d": "array(len=0)",
        "1h": "array(len=0)"
      },
      "topBots": {
        "24h": "array(len=0)",
        "7d": "array(len=0)",
        "1h": "array(len=0)"
      },
      "overall": {},
      "byAsset": {
        "24h": "array(len=0)",
        "7d": "array(len=0)",
        "1h": "array(len=0)"
      },
      "meta": {
        "signalsScanned": "<number>",
        "minBotSignals": "<number>",
        "lookbackDays": "<number>",
        "minSymbolSignals": "<number>",
        "runId": "<string>"
      },
      "updatedAt": "<timestamp>"
    }
    ```
    
- bots/* (found)
  - fields: engine, name, id, summary, desiredConfig, desiredConfigUpdatedAt, capabilities, state, status, lastHeartbeat, updatedAt
  - sample:
    
    ```json
    {
      "engine": "<string>",
      "name": "<string>",
      "id": "<string>",
      "summary": {
        "positions": "<number>"
      },
      "desiredConfig": {
        "mode": "<string>",
        "strategy": "<string>",
        "timeframe": "<string>",
        "advanced": "<map>",
        "exchange": "<string>",
        "risk": "<map>",
        "pairs": "array(len=2)"
      },
      "desiredConfigUpdatedAt": "<timestamp>",
      "capabilities": {
        "modes": "array(len=3)",
        "timeframes": "array(len=6)",
        "exchanges": "array(len=5)"
      },
      "state": {
        "balance": "<map>",
        "health": "<map>",
        "openTrades": "<map>"
      },
      "status": "<string>",
      "lastHeartbeat": "<timestamp>",
      "updatedAt": "<timestamp>"
    }
    ```
    
- bots/*/signals/* (found)
  - fields: botId, symbol, side, strength, message, data, createdAt
  - sample:
    
    ```json
    {
      "botId": "<string>",
      "symbol": "<string>",
      "side": "<string>",
      "strength": "<number>",
      "message": "<string>",
      "data": {
        "pair": "<string>",
        "source": "<string>",
        "raw": "array(len=5)"
      },
      "createdAt": "<timestamp>"
    }
    ```
    
