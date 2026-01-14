/**
 * Backtrader Adapter
 * REST API wrapper for Backtrader trading framework
 * Enhanced with multi-indicator signal support and asset-class awareness
 */

class BacktraderAdapter {
  constructor(bot) {
    this.bot = bot;
    this.baseUrl = bot.api?.baseUrl || 'http://localhost:8080';
    this.signalDeduper = new Set();
    this.lastRunId = null;
    this.lastRunAt = 0;
    this.minRunIntervalMs = Math.max(60000, (bot.pollIntervalSeconds || 300) * 1000);
  }

  /**
   * Create a deduplication key for a signal
   */
  _getSignalKey(sig) {
    return `${sig.symbol}-${sig.side}-${sig.timestamp || ''}-${sig.strategy_id || ''}`;
  }

  /**
   * Normalize a signal to RelayOrb format
   */
  _normalizeSignal(sig, assetClass) {
    const side = String(sig.side || '').toLowerCase();
    if (side !== 'buy' && side !== 'sell') return null;

    return {
      symbol: sig.symbol,
      side,
      price: sig.price,
      strength: typeof sig.strength === 'number' ? sig.strength : 0.65,
      message: sig.message || `${side.toUpperCase()} signal for ${sig.symbol}`,
      timestamp: new Date(sig.timestamp || Date.now()).toISOString(),
      source: 'backtrader',
      assetClass: sig.assetClass || assetClass,
      data: {
        pair: sig.symbol,
        symbol: sig.symbol,
        source: 'backtrader',
        assetClass: sig.assetClass || assetClass,
        indicators: sig.indicators || {
          rsi: sig.rsi,
          sma: sig.sma,
          macd: sig.macd,
          macd_signal: sig.macd_signal,
          bb_upper: sig.bb_upper,
          bb_lower: sig.bb_lower,
        },
        confluence: sig.confluence,
        crossover: sig.crossover,
        strategy_id: sig.strategy_id,
      }
    };
  }

  /**
   * Calculate adaptive wait time based on symbol count and asset class
   */
  _calculateWaitTime(symbolCount, assetClass) {
    const baseMs = assetClass === 'crypto' ? 600 : assetClass === 'forex' ? 700 : 800;
    return Math.min(90000, Math.max(10000, symbolCount * baseMs));
  }

  async poll() {
    const state = {};
    let status = 'offline';
    const events = [];
    const signals = [];

    try {
      const healthRes = await fetch(`${this.baseUrl}/health`);
      if (healthRes.ok) {
        status = 'online';
        state.health = await healthRes.json();
      }
    } catch (error) {
      console.error(`[Backtrader] Health check failed:`, error.message);
      return { status: 'offline', state: { error: error.message }, signals: [], events: [] };
    }

    const symbols = this.bot.desiredConfig?.symbols || [];
    const assetClass = this.bot.desiredConfig?.assetClass || 'stock';
    const timeframe = this.bot.desiredConfig?.timeframe || '1d';
    const strategy = this.bot.desiredConfig?.strategy || 'default';

    // Check if we should run a new strategy
    const now = Date.now();
    if (symbols.length > 0 && now - this.lastRunAt >= this.minRunIntervalMs) {
      try {
        this.lastRunId = `${this.bot.id}-${now}`;
        this.lastRunAt = now;

        const runRes = await fetch(`${this.baseUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: this.lastRunId,
            config: { symbols, assetClass, timeframe, strategy }
          })
        });

        if (runRes.ok) {
          console.log(`[Backtrader] Strategy run started: ${this.lastRunId}`);
          // Wait for strategy to complete
          const waitMs = this._calculateWaitTime(symbols.length, assetClass);
          await new Promise(resolve => setTimeout(resolve, waitMs));
        } else {
          events.push({
            type: 'log',
            severity: 'warn',
            message: `Strategy run failed: ${runRes.statusText}`
          });
        }
      } catch (error) {
        events.push({
          type: 'log',
          severity: 'error',
          message: `Strategy run error: ${error.message}`
        });
      }
    }

    // Get signals
    try {
      const query = this.lastRunId ? `?strategy_id=${encodeURIComponent(this.lastRunId)}` : '';
      const signalsRes = await fetch(`${this.baseUrl}/signals${query}`);
      
      if (signalsRes.ok) {
        const data = await signalsRes.json();
        const rawSignals = Array.isArray(data.signals) ? data.signals : [];

        for (const sig of rawSignals) {
          const sigKey = this._getSignalKey(sig);
          if (this.signalDeduper.has(sigKey)) continue;
          
          const normalized = this._normalizeSignal(sig, assetClass);
          if (!normalized) continue;

          this.signalDeduper.add(sigKey);
          signals.push(normalized);
        }
      }
    } catch (error) {
      events.push({
        type: 'log',
        severity: 'warn',
        message: `Signals fetch failed: ${error.message}`
      });
    }

    // Prune old deduplication entries (keep last 500)
    if (this.signalDeduper.size > 500) {
      const entries = Array.from(this.signalDeduper);
      this.signalDeduper.clear();
      entries.slice(-250).forEach(e => this.signalDeduper.add(e));
    }

    return { status, state, signals, events };
  }

  /**
   * Execute a scan/analyze command for specific symbols
   */
  async executeCommand(type, payload) {
    if (type !== 'scan' && type !== 'analyze') {
      throw new Error('Backtrader adapter only supports scan/analyze commands.');
    }

    const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
    if (symbols.length === 0) {
      throw new Error('scan/analyze requires symbols array in payload');
    }

    const assetClass = payload?.assetClass || this.bot.desiredConfig?.assetClass || 'stock';
    const timeframe = payload?.timeframe || this.bot.desiredConfig?.timeframe || '1d';
    const strategy = payload?.strategy || this.bot.desiredConfig?.strategy || 'default';
    
    const scanId = `${this.bot.id}-scan-${Date.now()}`;
    this.lastRunId = scanId;

    // Run strategy
    const runRes = await fetch(`${this.baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: scanId,
        config: { symbols, assetClass, timeframe, strategy }
      })
    });

    if (!runRes.ok) {
      throw new Error(`Strategy run failed: ${runRes.statusText}`);
    }

    // Wait with adaptive timing
    const initialWait = this._calculateWaitTime(symbols.length, assetClass);
    await new Promise(resolve => setTimeout(resolve, initialWait));

    // Retry with exponential backoff
    const signals = [];
    const retryDelays = [3000, 5000, 8000, 12000, 15000];
    
    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        const signalsRes = await fetch(
          `${this.baseUrl}/signals?strategy_id=${encodeURIComponent(scanId)}`
        );
        
        if (signalsRes.ok) {
          const data = await signalsRes.json();
          const rawSignals = Array.isArray(data.signals) ? data.signals : [];

          for (const sig of rawSignals) {
            const sigKey = this._getSignalKey(sig);
            if (this.signalDeduper.has(sigKey)) continue;
            
            const normalized = this._normalizeSignal(sig, assetClass);
            if (!normalized) continue;

            this.signalDeduper.add(sigKey);
            signals.push(normalized);
          }

          if (signals.length > 0 || attempt === retryDelays.length) break;
        }
      } catch (error) {
        console.error(`[Backtrader] Signals retry ${attempt} failed:`, error.message);
      }

      if (attempt < retryDelays.length) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }

    return { status: 'online', signals, scanId, analyzed: symbols.length };
  }

  getMarketMovers() {
    // Not implemented for Backtrader
    return [];
  }
}

module.exports = BacktraderAdapter;
