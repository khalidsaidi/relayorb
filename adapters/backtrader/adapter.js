/**
 * Backtrader Adapter
 * REST API wrapper for Backtrader trading framework
 */

class BacktraderAdapter {
  constructor(bot) {
    this.bot = bot;
    this.baseUrl = bot.api?.baseUrl || 'http://localhost:8080';
    this.signalDeduper = new Set();
  }

  async poll() {
    const state = {};
    let status = 'offline';

    try {
      // Check health
      const healthRes = await fetch(`${this.baseUrl}/health`);
      if (healthRes.ok) {
        status = 'online';
      }
    } catch (error) {
      console.error(`[Backtrader] Health check failed:`, error.message);
      return { state: { status: 'offline', error: error.message }, signals: [] };
    }

    const signals = [];
    
    try {
      // Trigger strategy run if symbols are configured
      const symbols = this.bot.desiredConfig?.symbols || [];
      const assetClass = this.bot.desiredConfig?.assetClass || 'stock';
      const timeframe = this.bot.desiredConfig?.timeframe || '1d';
      
      if (symbols.length > 0) {
        // Run strategy
        const runRes = await fetch(`${this.baseUrl}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `${this.bot.id}-${Date.now()}`,
            config: {
              symbols,
              assetClass,
              timeframe,
              strategy: 'default'
            }
          })
        });

        if (!runRes.ok) {
          console.error(`[Backtrader] Run failed: ${runRes.statusText}`);
        } else {
          console.log(`[Backtrader] Strategy run started for ${symbols.join(', ')}`);
          
          // Wait a bit for strategy to complete
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }

      // Get signals
      const signalsRes = await fetch(`${this.baseUrl}/signals`);
      if (signalsRes.ok) {
        const data = await signalsRes.json();
        
        if (data.signals && Array.isArray(data.signals)) {
          for (const sig of data.signals) {
            // Deduplicate signals
            const sigKey = `${sig.symbol}-${sig.side}-${sig.timestamp}`;
            if (this.signalDeduper.has(sigKey)) {
              continue;
            }
            this.signalDeduper.add(sigKey);
            
            // Convert to RelayOrb signal format
            signals.push({
              symbol: sig.symbol,
              side: sig.side.toUpperCase(),
              price: sig.price,
              strength: sig.strength || 0.5,
              message: sig.message || `${sig.side.toUpperCase()} signal for ${sig.symbol}`,
              timestamp: new Date(sig.timestamp || Date.now()).toISOString(),
              source: 'backtrader',
              assetClass: sig.assetClass || assetClass,
              metadata: {
                rsi: sig.rsi,
                sma: sig.sma,
                strategy_id: sig.strategy_id
              }
            });
          }
        }
      }
    } catch (error) {
      console.error(`[Backtrader] Error polling:`, error);
    }

    return {
      state: { status },
      signals
    };
  }

  async executeCommand(command) {
    throw new Error('Backtrader adapter is signal-only. Use a trade execution engine.');
  }

  getMarketMovers() {
    // Not implemented for Backtrader
    return [];
  }
}

module.exports = BacktraderAdapter;
