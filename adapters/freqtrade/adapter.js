/**
 * Freqtrade Adapter
 * REST API wrapper for Freqtrade trading bot
 * Enhanced with active scanning and dataframe analysis capabilities
 */

class FreqtradeAdapter {
  constructor(bot) {
    this.bot = bot;
    this.baseUrl = bot.api?.baseUrl || 'http://localhost:8080';
    this.username = bot.api?.username;
    this.password = bot.api?.password;
    this.accessToken = null;
    this.signalDeduper = new Set();
    this.logDeduper = new Set();
  }

  /**
   * Login to Freqtrade API and get access token
   */
  async login() {
    if (!this.username || !this.password) {
      throw new Error('Freqtrade username/password missing');
    }
    
    const basic = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/token/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` }
    });
    
    if (!res.ok) {
      throw new Error(`Freqtrade login failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    this.accessToken = data?.access_token || null;
    
    if (!this.accessToken) {
      throw new Error('Freqtrade login failed (no access token)');
    }
  }

  /**
   * Make an authenticated request to Freqtrade API
   */
  async request(endpoint, { method = 'GET', auth = true, body } = {}) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    
    if (auth) {
      if (!this.accessToken) await this.login();
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });

    // Handle 401 with retry
    if (res.status === 401 && auth) {
      await this.login();
      headers.Authorization = `Bearer ${this.accessToken}`;
      const retryRes = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      if (!retryRes.ok) throw new Error(`Request failed: ${retryRes.statusText}`);
      if (retryRes.status === 204) return null;
      return retryRes.json();
    }

    if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
    if (res.status === 204) return null;
    return res.json();
  }

  /**
   * Normalize a pair to standard format
   */
  _normalizePair(pair) {
    if (!pair) return pair;
    return String(pair).trim().toUpperCase().replace(/-/g, '/');
  }

  /**
   * Extract signals from log entries
   */
  _extractSignalsFromLogs(entries) {
    const signals = [];
    
    for (const entry of entries) {
      const message = String(entry?.message || entry?.msg || '');
      const lower = message.toLowerCase();
      
      let side = null;
      if (lower.includes('entering trade') || lower.includes('buy signal')) side = 'buy';
      if (lower.includes('exiting trade') || lower.includes('sell signal')) side = 'sell';
      if (!side) continue;

      const pairMatch = message.match(/([A-Z0-9]{2,}[/-][A-Z0-9]{2,})/i);
      const pair = entry?.data?.pair || pairMatch?.[1] || null;
      
      if (!pair) continue;

      signals.push({
        symbol: this._normalizePair(pair),
        side,
        strength: 0.70,
        message: `${side.toUpperCase()} signal for ${pair}`,
        source: 'freqtrade_logs',
        data: {
          pair: this._normalizePair(pair),
          source: 'logs',
          raw: entry?.data || null,
          assetClass: 'crypto'
        }
      });
    }
    
    return signals;
  }

  /**
   * Extract signals from open trades
   */
  _extractSignalsFromTrades(trades) {
    if (!Array.isArray(trades)) return [];
    
    return trades.map(trade => {
      const pair = trade?.pair || trade?.symbol;
      if (!pair) return null;
      
      return {
        symbol: this._normalizePair(pair),
        side: 'buy',
        strength: 0.60,
        message: `Active trade ${pair}`,
        source: 'freqtrade_trades',
        data: {
          pair: this._normalizePair(pair),
          source: 'open_trades',
          profit: trade?.profit_pct,
          duration: trade?.trade_duration,
          assetClass: 'crypto'
        }
      };
    }).filter(Boolean);
  }

  /**
   * Extract signals from analyzed dataframe
   */
  _extractSignalsFromDataframe(pair, dataframe) {
    if (!dataframe?.data?.length) return [];
    
    const signals = [];
    const columns = dataframe.columns || [];
    const data = dataframe.data;
    
    const dateIdx = columns.indexOf('date');
    const closeIdx = columns.indexOf('close');
    const enterIdx = columns.indexOf('enter_long') >= 0 
      ? columns.indexOf('enter_long') 
      : columns.indexOf('buy');
    const exitIdx = columns.indexOf('exit_long') >= 0 
      ? columns.indexOf('exit_long') 
      : columns.indexOf('sell');
    const rsiIdx = columns.indexOf('rsi');
    
    // Check last few candles
    const checkCount = Math.min(5, data.length);
    for (let i = data.length - checkCount; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;
      
      const hasEnter = enterIdx >= 0 && row[enterIdx] === 1;
      const hasExit = exitIdx >= 0 && row[exitIdx] === 1;
      
      if (!hasEnter && !hasExit) continue;
      
      signals.push({
        symbol: this._normalizePair(pair),
        side: hasEnter ? 'buy' : 'sell',
        strength: 0.80,
        message: `Strategy signal for ${pair}`,
        timestamp: dateIdx >= 0 ? row[dateIdx] : new Date().toISOString(),
        source: 'freqtrade_dataframe',
        data: {
          pair: this._normalizePair(pair),
          source: 'dataframe',
          price: closeIdx >= 0 ? row[closeIdx] : null,
          indicators: rsiIdx >= 0 ? { rsi: row[rsiIdx] } : {},
          assetClass: 'crypto'
        }
      });
    }
    
    return signals;
  }

  async poll() {
    const state = {};
    let status = 'offline';
    const events = [];
    const signals = [];

    try {
      await this.request('/ping', { auth: false });
      status = 'online';
    } catch {
      return { status: 'offline', state, signals: [], events: [] };
    }

    // Get health
    try {
      state.health = await this.request('/health');
    } catch (e) {
      state.health = { error: e.message };
    }

    // Get open trades
    try {
      state.openTrades = await this.request('/status');
      const tradeSignals = this._extractSignalsFromTrades(state.openTrades);
      for (const sig of tradeSignals) {
        const key = `trade-${sig.symbol}`;
        if (!this.signalDeduper.has(key)) {
          this.signalDeduper.add(key);
          signals.push(sig);
        }
      }
    } catch (e) {
      state.openTrades = { error: e.message };
    }

    // Get balance
    try {
      state.balance = await this.request('/balance');
    } catch (e) {
      state.balance = { error: e.message };
    }

    // Get logs and extract signals
    try {
      const rawLogs = await this.request('/logs');
      const logs = Array.isArray(rawLogs?.logs) ? rawLogs.logs : 
                   Array.isArray(rawLogs) ? rawLogs : [];
      
      for (const entry of logs.slice(0, 30)) {
        const key = JSON.stringify(entry);
        if (!this.logDeduper.has(key)) {
          this.logDeduper.add(key);
          events.push({
            type: 'log',
            severity: entry.level || 'info',
            message: entry.message || entry.msg || String(entry),
            data: entry
          });
        }
      }
      
      const logSignals = this._extractSignalsFromLogs(logs);
      for (const sig of logSignals) {
        const key = `log-${sig.symbol}-${sig.side}`;
        if (!this.signalDeduper.has(key)) {
          this.signalDeduper.add(key);
          signals.push(sig);
        }
      }
    } catch (e) {
      events.push({ type: 'log', severity: 'warn', message: `Log fetch failed: ${e.message}` });
    }

    // Prune dedupers
    if (this.signalDeduper.size > 300) {
      const entries = Array.from(this.signalDeduper);
      this.signalDeduper.clear();
      entries.slice(-150).forEach(e => this.signalDeduper.add(e));
    }
    if (this.logDeduper.size > 500) {
      const entries = Array.from(this.logDeduper);
      this.logDeduper.clear();
      entries.slice(-250).forEach(e => this.logDeduper.add(e));
    }

    return { status, state, signals, events };
  }

  /**
   * Analyze specific symbols by requesting dataframes
   */
  async analyzeSymbols(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return { signals: [], analyzed: 0 };
    }

    const signals = [];
    const pairs = symbols.map(s => this._normalizePair(s));

    // Try to get available pairs
    let availablePairs = [];
    try {
      const pairlists = await this.request('/pairlists');
      availablePairs = Array.isArray(pairlists?.whitelist) ? pairlists.whitelist : [];
    } catch {
      // Use provided pairs as-is
    }

    const validPairs = availablePairs.length > 0
      ? pairs.filter(p => availablePairs.some(ap => 
          ap === p || ap === p.replace('/', '') || ap.replace('/', '') === p.replace('/', '')))
      : pairs;

    for (const pair of validPairs.slice(0, 10)) {
      try {
        const dfResult = await this.request('/dataframe', {
          method: 'POST',
          body: { pair }
        });

        if (dfResult?.data) {
          const pairSignals = this._extractSignalsFromDataframe(pair, dfResult);
          for (const sig of pairSignals) {
            const key = `df-${sig.symbol}-${sig.side}-${sig.timestamp}`;
            if (!this.signalDeduper.has(key)) {
              this.signalDeduper.add(key);
              signals.push(sig);
            }
          }
        }
      } catch {
        // Dataframe endpoint may not be available
      }
    }

    return { signals, analyzed: validPairs.length };
  }

  async executeCommand(type, payload) {
    switch (type) {
      case 'start':
        await this.request('/start', { method: 'POST' });
        return { status: 'online' };
      
      case 'stop':
        await this.request('/stop', { method: 'POST' });
        return { status: 'idle' };
      
      case 'restart':
        await this.request('/stop', { method: 'POST' });
        await this.request('/start', { method: 'POST' });
        return { status: 'online' };
      
      case 'reload_config':
        await this.request('/reload_config', { method: 'POST' });
        return { status: 'online' };
      
      case 'scan':
      case 'analyze':
        const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
        if (symbols.length === 0) {
          return { status: 'online', signals: [], error: 'No symbols provided' };
        }
        const result = await this.analyzeSymbols(symbols);
        return { status: 'online', ...result };
      
      default:
        throw new Error(`Unsupported command: ${type}`);
    }
  }
}

module.exports = FreqtradeAdapter;
