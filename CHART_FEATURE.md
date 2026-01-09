# Live Chart Feature

## Overview

Added live chart functionality to asset cards using Twelve Data API and TradingView's lightweight-charts library. Each asset card now has a chart button that opens a modal with real-time price charts.

## Features

✅ **Chart Button**: Added to each asset card in TradeNow page  
✅ **Live Data**: Fetches real-time data from Twelve Data API  
✅ **Interactive Charts**: Uses TradingView lightweight-charts for professional charts  
✅ **Multi-Asset Support**: Works for crypto, stocks, and forex  
✅ **5-Minute Candles**: Shows last 100 candles (~8 hours of data)  

## API Key Configuration

The Twelve Data API key is configured in the chart component. To use environment variable:

1. Add to `.env` file:
   ```
   VITE_TWELVE_DATA_API_KEY=c8548aba8fc54ced91926bc2219cf4e2
   ```

2. Or it will use the hardcoded key as fallback (already set)

## How It Works

1. **User clicks chart button** on any asset card
2. **Modal opens** with loading state
3. **Fetches data** from Twelve Data API:
   - Crypto: Uses base symbol (BTC, ETH, etc.)
   - Stocks: Uses symbol as-is (AAPL, MSFT, etc.)
   - Forex: Converts EUR/USD → EURUSD
4. **Renders chart** using lightweight-charts library
5. **Shows asset info** below chart (price, change, score, side)

## Symbol Normalization

The system automatically normalizes symbols for Twelve Data:
- **Crypto**: `BTC/USDT` → `BTC`
- **Stocks**: `AAPL` → `AAPL` (unchanged)
- **Forex**: `EUR/USD` → `EURUSD`

## Chart Features

- **5-minute candles** (last 100 = ~8 hours)
- **Color coding**: Green for up, red for down
- **Responsive**: Adapts to modal size
- **Time scale**: Shows time labels
- **Auto-fit**: Automatically fits content to view

## Files Added/Modified

1. **`src/components/charts/AssetChartModal.tsx`** - Chart modal component
2. **`src/pages/TradeNowPage.tsx`** - Added chart button and modal integration
3. **`package.json`** - Added `lightweight-charts` dependency

## Usage

1. Navigate to Trade Now page
2. Find any asset card (buy or sell list)
3. Click the chart icon (📊) in the top-right of the card
4. Modal opens with live chart
5. View price history and current data

## API Limits

Twelve Data free tier:
- 800 API calls/day
- 8 calls/minute
- Real-time data for major assets

**Note**: Chart data is fetched on-demand when modal opens, so API usage is minimal.

## Future Enhancements

- Add different timeframes (1m, 15m, 1h, 4h, 1d)
- Add technical indicators (RSI, MACD, etc.)
- Add volume overlay
- Cache chart data to reduce API calls
- Add WebSocket for real-time updates

## Troubleshooting

If charts don't load:
1. Check browser console for errors
2. Verify API key is valid
3. Check if symbol is supported by Twelve Data
4. Verify network connection

If symbol not found:
- Some symbols may not be available in Twelve Data
- Try checking symbol format (e.g., crypto might need exchange prefix)
