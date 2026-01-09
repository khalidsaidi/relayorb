/**
 * Alpaca Adapter for Stock Trading Signals
 * Connects to Alpaca Markets API for US stocks
 */

import Alpaca from '@alpacahq/alpaca-trade-api';

class AlpacaAdapter {
  constructor(bot) {
    this.bot = bot;
    this.signalDeduper = new Set();
    try {
      this.alpaca = new Alpaca({
        keyId: process.env.ALPACA_API_KEY,
        secretKey: process.env.ALPACA_SECRET_KEY,
        paper: true, // Use paper trading for signals
        usePolygon: false
      });
    } catch (err) {
      console.error('Alpaca initialization error:', err);
      this.alpaca = null;
    }
  }

  async poll() {
    const state = {};
    let status = 'offline';
    const events = [];
    const signals = [];

    if (!this.alpaca) {
      return { status: 'error', state: { error: 'Alpaca not initialized - check API keys' }, events, signals };
    }

    try {
      // Get market movers
      const movers = await this.getMarketMovers();
      
      // Technical analysis on top stocks
      const rawSignals = await this.generateSignals(movers);
      
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
            source: 'alpaca'
          }
        });
      }

      state.moversCount = movers.length;
      status = 'online';
    } catch (error) {
      console.error('Alpaca poll error:', error);
      events.push({
        type: 'log',
        severity: 'error',
        message: `Alpaca poll failed: ${error.message}`,
        data: { error: String(error) }
      });
      state.error = String(error);
    }

    return { status, state, events, signals };
  }

  async executeCommand(type, payload) {
    // Alpaca adapter doesn't support commands - it's signal-only
    throw new Error(`Alpaca adapter does not support '${type}' command`);
  }

  async getMarketMovers() {
    // Use symbols from bot config or default list
    const symbols = this.bot.desiredConfig?.symbols || 
      ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'GOOGL', 'AMZN', 'AMD'];
    
    // Get top gainers/losers
    const snapshots = await this.alpaca.getSnapshots({ symbols });
    
    return Object.entries(snapshots).map(([symbol, data]) => ({
      symbol,
      price: data.latestTrade?.p,
      volume: data.dailyBar?.v,
      change: data.dailyBar?.c - data.prevDailyBar?.c,
      changePercent: ((data.dailyBar?.c - data.prevDailyBar?.c) / data.prevDailyBar?.c) * 100
    }));
  }

  async generateSignals(movers) {
    const signals = [];
    
    for (const stock of movers) {
      // Get historical bars for technical analysis
      const bars = await this.alpaca.getBarsV2(
        stock.symbol,
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          timeframe: '1Day'
        }
      );
      
      const prices = [];
      for await (const bar of bars) {
        prices.push(bar.c);
      }
      
      // Simple technical indicators
      const sma20 = this.calculateSMA(prices, 20);
      const rsi = this.calculateRSI(prices, 14);
      
      // Generate signal
      let side = 'hold';
      let strength = 0;
      let message = '';
      
      if (rsi < 30 && stock.price > sma20) {
        side = 'buy';
        strength = 0.8;
        message = `Oversold with price above SMA20`;
      } else if (rsi > 70 && stock.price < sma20) {
        side = 'sell';
        strength = 0.8;
        message = `Overbought with price below SMA20`;
      }
      
      if (side !== 'hold') {
        signals.push({
          symbol: stock.symbol,
          assetClass: 'stock',
          side,
          strength,
          message,
          price: stock.price,
          indicators: { rsi, sma20 }
        });
      }
    }
    
    return signals;
  }

  calculateSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;
    
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

}

export default AlpacaAdapter;