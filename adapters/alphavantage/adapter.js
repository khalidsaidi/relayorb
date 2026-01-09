/**
 * Alpha Vantage Adapter for Stock Trading Signals
 * Works globally including Canada
 * Uses Alpha Vantage API (already integrated in market-intel)
 */

class AlphaVantageAdapter {
  constructor(bot) {
    this.bot = bot;
    this.apiKey = process.env.ALPHAVANTAGE_API_KEY;
    this.signalDeduper = new Set();
  }

  async poll() {
    const state = {};
    let status = 'offline';
    const events = [];
    const signals = [];

    if (!this.apiKey) {
      return { 
        status: 'error', 
        state: { error: 'Alpha Vantage API key not configured' }, 
        events, 
        signals 
      };
    }

    try {
      const symbols = this.bot.desiredConfig?.symbols || 
        ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'AMD', 'SPY', 'QQQ'];
      
      // Alpha Vantage rate limit: 5 calls/minute, so we'll process symbols in batches
      // Process max 3 symbols per poll to respect rate limits
      const symbolsToProcess = symbols.slice(0, 3);
      
      const rawSignals = [];
      
      for (const symbol of symbolsToProcess) {
        try {
          // Small delay between API calls to respect rate limit
          if (rawSignals.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 13000)); // 13 seconds = ~4.6 calls/min
          }
          
          const signal = await this.generateSignal(symbol);
          if (signal) {
            rawSignals.push(signal);
          }
        } catch (err) {
          events.push({
            type: 'log',
            severity: 'warn',
            message: `Failed to generate signal for ${symbol}: ${err.message}`,
            data: { symbol, error: String(err) }
          });
        }
      }

      // Convert to agent signal format and dedupe
      for (const signal of rawSignals) {
        const key = JSON.stringify({ symbol: signal.symbol, side: signal.side, message: signal.message });
        if (this.signalDeduper.has(key)) continue;
        this.signalDeduper.add(key);
        
        // Limit deduper size
        if (this.signalDeduper.size > 1000) {
          const first = this.signalDeduper.values().next().value;
          this.signalDeduper.delete(first);
        }

        signals.push({
          side: signal.side,
          strength: signal.strength,
          message: signal.message,
          data: {
            symbol: signal.symbol,
            assetClass: signal.assetClass,
            price: signal.price,
            indicators: signal.indicators,
            source: 'alphavantage'
          }
        });
      }

      state.symbolsProcessed = symbolsToProcess.length;
      state.symbolsTotal = symbols.length;
      status = 'online';
    } catch (error) {
      console.error('Alpha Vantage poll error:', error);
      events.push({
        type: 'log',
        severity: 'error',
        message: `Alpha Vantage poll failed: ${error.message}`,
        data: { error: String(error) }
      });
      state.error = String(error);
    }

    return { status, state, events, signals };
  }

  async generateSignal(symbol) {
    // Get current quote
    const quoteUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`;
    const quoteResponse = await fetch(quoteUrl);
    const quoteData = await quoteResponse.json();
    
    if (quoteData['Error Message'] || quoteData['Note']) {
      throw new Error(quoteData['Error Message'] || quoteData['Note'] || 'Alpha Vantage API error');
    }

    const globalQuote = quoteData['Global Quote'];
    if (!globalQuote || !globalQuote['05. price']) {
      return null;
    }

    const currentPrice = parseFloat(globalQuote['05. price']);
    const changePercent = parseFloat(String(globalQuote['10. change percent'] || '0').replace(/%/g, ''));

    // Get historical daily data for technical analysis
    // Note: Using daily data due to free tier limitations
    const dailyUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}&outputsize=compact`;
    const dailyResponse = await fetch(dailyUrl);
    const dailyData = await dailyResponse.json();
    
    if (dailyData['Error Message'] || dailyData['Note']) {
      // Fallback to quote-only signal if daily data fails
      return this.createMomentumSignal(symbol, currentPrice, changePercent);
    }

    const timeSeries = dailyData['Time Series (Daily)'];
    if (!timeSeries) {
      return this.createMomentumSignal(symbol, currentPrice, changePercent);
    }

    // Extract closing prices (last 50 days)
    const dates = Object.keys(timeSeries).sort().reverse().slice(0, 50);
    const closes = dates.map(date => parseFloat(timeSeries[date]['4. close']));

    if (closes.length < 20) {
      return this.createMomentumSignal(symbol, currentPrice, changePercent);
    }

    // Calculate technical indicators
    const sma20 = this.calculateSMA(closes, 20);
    const rsi = this.calculateRSI(closes, 14);

    if (sma20 === null || rsi === null) {
      return this.createMomentumSignal(symbol, currentPrice, changePercent);
    }

    // Generate signal based on technical analysis
    let side = 'hold';
    let strength = 0;
    let message = '';

    // Oversold + Price above SMA = Buy signal
    if (rsi < 30 && currentPrice > sma20) {
      side = 'buy';
      strength = 0.75;
      message = `RSI oversold (${rsi.toFixed(1)}), price above SMA20 (${sma20.toFixed(2)})`;
    }
    // Overbought + Price below SMA = Sell signal
    else if (rsi > 70 && currentPrice < sma20) {
      side = 'sell';
      strength = 0.75;
      message = `RSI overbought (${rsi.toFixed(1)}), price below SMA20 (${sma20.toFixed(2)})`;
    }
    // Strong momentum with RSI confirmation
    else if (changePercent > 2 && rsi < 70 && rsi > 40 && currentPrice > sma20) {
      side = 'buy';
      strength = 0.65;
      message = `Strong momentum (+${changePercent.toFixed(2)}%), RSI ${rsi.toFixed(1)}, above SMA20`;
    }
    else if (changePercent < -2 && rsi > 30 && rsi < 60 && currentPrice < sma20) {
      side = 'sell';
      strength = 0.65;
      message = `Negative momentum (${changePercent.toFixed(2)}%), RSI ${rsi.toFixed(1)}, below SMA20`;
    }

    if (side === 'hold') {
      return null;
    }

    return {
      symbol,
      assetClass: 'stock',
      side,
      strength,
      message,
      price: currentPrice,
      indicators: {
        rsi: rsi.toFixed(2),
        sma20: sma20.toFixed(2),
        change24h: changePercent.toFixed(2)
      }
    };
  }

  createMomentumSignal(symbol, price, changePercent) {
    // Simple momentum-based signal when technical data unavailable
    if (Math.abs(changePercent) < 1.5) {
      return null; // Not enough movement
    }

    const side = changePercent > 0 ? 'buy' : 'sell';
    const strength = Math.min(Math.abs(changePercent) / 10, 0.8); // Max 0.8 strength

    return {
      symbol,
      assetClass: 'stock',
      side,
      strength: Math.max(strength, 0.5),
      message: `${changePercent > 0 ? 'Strong' : 'Negative'} momentum: ${changePercent.toFixed(2)}% (quote-only, no TA)`,
      price,
      indicators: {
        change24h: changePercent.toFixed(2)
      }
    };
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return null;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  async executeCommand(type, payload) {
    // Alpha Vantage adapter doesn't support commands - it's signal-only
    throw new Error(`Alpha Vantage adapter does not support '${type}' command`);
  }
}

export default AlphaVantageAdapter;