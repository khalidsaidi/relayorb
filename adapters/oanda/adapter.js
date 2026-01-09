/**
 * OANDA Adapter for Forex Trading Signals
 * Connects to OANDA v20 API for forex pairs
 */

import axios from 'axios';

class OandaAdapter {
  constructor(bot) {
    this.bot = bot;
    this.apiKey = process.env.OANDA_API_KEY;
    this.accountId = process.env.OANDA_ACCOUNT_ID;
    this.baseUrl = process.env.OANDA_PRACTICE === 'true' 
      ? 'https://api-fxpractice.oanda.com/v3'
      : 'https://api-fxtrade.oanda.com/v3';
    
    this.pairs = bot.desiredConfig?.pairs?.map(p => p.replace('/', '_')) || [
      'EUR_USD', 'GBP_USD', 'USD_JPY', 'USD_CHF',
      'AUD_USD', 'USD_CAD', 'NZD_USD', 'EUR_JPY'
    ];
    this.signalDeduper = new Set();
  }

  async poll() {
    const state = {};
    let status = 'offline';
    const events = [];
    const signals = [];

    if (!this.apiKey || !this.accountId) {
      return { status: 'error', state: { error: 'OANDA API key or account ID missing' }, events, signals };
    }

    try {
      // Get current prices
      const prices = await this.getCurrentPrices();
      
      // Get market sentiment
      const sentiment = await this.getMarketSentiment();
      
      // Technical analysis
      const rawSignals = await this.generateSignals(prices, sentiment);
      
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
            spread: signal.spread,
            indicators: signal.indicators,
            source: 'oanda'
          }
        });
      }

      state.pairsCount = this.pairs.length;
      state.pricesCount = prices.length;
      status = 'online';
    } catch (error) {
      console.error('OANDA poll error:', error);
      events.push({
        type: 'log',
        severity: 'error',
        message: `OANDA poll failed: ${error.message}`,
        data: { error: String(error) }
      });
      state.error = String(error);
    }

    return { status, state, events, signals };
  }

  async executeCommand(type, payload) {
    // OANDA adapter doesn't support commands - it's signal-only
    throw new Error(`OANDA adapter does not support '${type}' command`);
  }

  async getCurrentPrices() {
    const response = await axios.get(
      `${this.baseUrl}/accounts/${this.accountId}/pricing`,
      {
        params: { instruments: this.pairs.join(',') },
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      }
    );
    
    return response.data.prices.map(price => ({
      pair: price.instrument.replace('_', '/'),
      bid: parseFloat(price.bids[0].price),
      ask: parseFloat(price.asks[0].price),
      spread: parseFloat(price.asks[0].price) - parseFloat(price.bids[0].price)
    }));
  }

  async getMarketSentiment() {
    // OANDA provides position ratios showing long vs short positions
    const sentiment = {};
    
    for (const pair of this.pairs) {
      try {
        const response = await axios.get(
          `${this.baseUrl}/instruments/${pair}/positionBook`,
          { headers: { 'Authorization': `Bearer ${this.apiKey}` } }
        );
        
        const book = response.data.positionBook;
        const longPercent = parseFloat(book.buckets.reduce((sum, b) => sum + (b.longCountPercent || 0), 0));
        const shortPercent = parseFloat(book.buckets.reduce((sum, b) => sum + (b.shortCountPercent || 0), 0));
        
        sentiment[pair] = {
          longPercent,
          shortPercent,
          sentiment: longPercent > 60 ? 'bullish' : shortPercent > 60 ? 'bearish' : 'neutral'
        };
      } catch (error) {
        console.error(`Failed to get sentiment for ${pair}:`, error.message);
      }
    }
    
    return sentiment;
  }

  async generateSignals(prices, sentiment) {
    const signals = [];
    
    for (const price of prices) {
      const pairKey = price.pair.replace('/', '_');
      const marketSentiment = sentiment[pairKey];
      
      // Get candles for technical analysis
      const candles = await this.getCandles(pairKey, 'H1', 50);
      
      if (candles.length > 20) {
        const closes = candles.map(c => c.mid.c);
        
        // Calculate indicators
        const sma20 = this.calculateSMA(closes, 20);
        const rsi = this.calculateRSI(closes, 14);
        const currentPrice = price.bid;
        
        // Generate signal based on multiple factors
        let side = 'hold';
        let strength = 0;
        let message = '';
        
        // Oversold + Bullish sentiment + Price above SMA
        if (rsi < 30 && marketSentiment?.sentiment === 'bullish' && currentPrice > sma20) {
          side = 'buy';
          strength = 0.85;
          message = `RSI oversold (${rsi.toFixed(0)}), ${marketSentiment.longPercent.toFixed(0)}% long positions`;
        }
        // Overbought + Bearish sentiment + Price below SMA
        else if (rsi > 70 && marketSentiment?.sentiment === 'bearish' && currentPrice < sma20) {
          side = 'sell';
          strength = 0.85;
          message = `RSI overbought (${rsi.toFixed(0)}), ${marketSentiment.shortPercent.toFixed(0)}% short positions`;
        }
        // Strong trend following
        else if (rsi > 50 && rsi < 70 && currentPrice > sma20 && marketSentiment?.sentiment === 'bullish') {
          side = 'buy';
          strength = 0.65;
          message = `Uptrend confirmed, ${marketSentiment.longPercent.toFixed(0)}% long sentiment`;
        }
        
        if (side !== 'hold') {
          signals.push({
            symbol: price.pair,
            assetClass: 'forex',
            side,
            strength,
            message,
            price: currentPrice,
            spread: price.spread,
            indicators: { 
              rsi: rsi.toFixed(2), 
              sma20: sma20.toFixed(5),
              sentiment: marketSentiment?.sentiment
            }
          });
        }
      }
    }
    
    return signals;
  }

  async getCandles(instrument, granularity, count) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/instruments/${instrument}/candles`,
        {
          params: { granularity, count },
          headers: { 'Authorization': `Bearer ${this.apiKey}` }
        }
      );
      
      return response.data.candles.map(c => ({
        time: c.time,
        mid: {
          o: parseFloat(c.mid.o),
          h: parseFloat(c.mid.h),
          l: parseFloat(c.mid.l),
          c: parseFloat(c.mid.c)
        },
        volume: c.volume
      }));
    } catch (error) {
      console.error(`Failed to get candles for ${instrument}:`, error.message);
      return [];
    }
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

export default OandaAdapter;