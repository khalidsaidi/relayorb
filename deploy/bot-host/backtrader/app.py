"""
Backtrader REST API Service
Runs on the VM alongside Freqtrade
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import backtrader as bt
import threading
import time
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Optional
import os

from datafeeds import get_datafeed
from strategies import create_strategy

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
cerebro_instances: Dict[str, bt.Cerebro] = {}
running_strategies: Dict[str, threading.Thread] = {}
strategy_signals: Dict[str, List[Dict]] = {}
strategy_status: Dict[str, Dict] = {}
strategy_configs: Dict[str, Dict] = {}


def run_strategy(strategy_id: str, config: Dict):
    """Run a Backtrader strategy in a separate thread"""
    try:
        logger.info(f"Starting strategy {strategy_id} with config: {config}")
        
        # Create cerebro
        cerebro = bt.Cerebro()
        
        # Get symbol(s) - support both single symbol and list
        symbols = config.get('symbols', [])
        symbol = config.get('symbol')
        if not symbols and symbol:
            symbols = [symbol]
        
        if not symbols:
            raise ValueError("Symbol or symbols required")
        
        asset_class = config.get('assetClass', 'stock')
        timeframe = config.get('timeframe', '1d')
        
        # Run strategy for each symbol
        all_signals = []
        for sym in symbols:
            try:
                datafeed = get_datafeed(sym, asset_class, timeframe)
                # Check if datafeed is None without evaluating it (which triggers Backtrader's __nonzero__)
                if datafeed is None:
                    logger.warning(f"Could not get data feed for {sym}, skipping")
                    continue
                
                # Create fresh cerebro for each symbol
                sym_cerebro = bt.Cerebro()
                
                # Add data feed to cerebro (must be done before adding strategy)
                sym_cerebro.adddata(datafeed, name=sym)
                
                # Add strategy - now asset-class aware
                strategy_class = create_strategy(
                    config.get('strategy', 'default'),
                    asset_class=asset_class
                )
                sym_cerebro.addstrategy(strategy_class)
                
                # Configure broker
                sym_cerebro.broker.setcash(config.get('initialCash', 10000.0))
                sym_cerebro.broker.setcommission(commission=config.get('commission', 0.001))
                
                logger.info(f"Running strategy for {sym}...")
                
                # Run the strategy
                try:
                    results = sym_cerebro.run()
                    
                    # Extract signals
                    if results and len(results) > 0:
                        strategy = results[0]
                        if hasattr(strategy, 'signals') and strategy.signals:
                            # Add symbol to each signal
                            for sig in strategy.signals:
                                sig['symbol'] = sym
                                sig['assetClass'] = asset_class
                            all_signals.extend(strategy.signals)
                            logger.info(f"Strategy for {sym} generated {len(strategy.signals)} signals")
                        else:
                            logger.info(f"Strategy for {sym} completed but no signals generated")
                except Exception as run_err:
                    logger.error(f"Error running cerebro for {sym}: {run_err}", exc_info=True)
                    continue
            
            except Exception as e:
                logger.error(f"Error processing {sym}: {e}", exc_info=True)
                continue
        
        # Store signals
        if all_signals:
            strategy_signals[strategy_id] = all_signals
            logger.info(f"Strategy {strategy_id} generated {len(all_signals)} total signals")
        
        strategy_status[strategy_id] = {
            "status": "completed",
            "completedAt": datetime.now().isoformat(),
            "signalsCount": len(all_signals),
            "symbolsProcessed": len(symbols)
        }
        
    except Exception as e:
        logger.error(f"Error running strategy {strategy_id}: {str(e)}", exc_info=True)
        strategy_status[strategy_id] = {
            "status": "error",
            "error": str(e),
            "updatedAt": datetime.now().isoformat()
        }


@app.route('/ping', methods=['GET'])
def ping():
    """Health check endpoint"""
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


@app.route('/health', methods=['GET'])
def health():
    """Detailed health check"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "activeStrategies": len([s for s in strategy_status.values() if s.get('status') == 'running']),
        "totalStrategies": len(strategy_status)
    })


@app.route('/status', methods=['GET'])
def status():
    """Get status - matches Freqtrade API"""
    # Return array format like Freqtrade
    return jsonify([])


@app.route('/signals', methods=['GET'])
def signals():
    """Get signals from all strategies"""
    strategy_id = request.args.get('strategy_id')
    
    if strategy_id:
        signals_list = strategy_signals.get(strategy_id, [])
        # Add strategy_id to each signal
        for sig in signals_list:
            sig['strategy_id'] = strategy_id
    else:
        signals_list = []
        for sid, sigs in strategy_signals.items():
            for sig in sigs:
                sig_copy = sig.copy()
                sig_copy['strategy_id'] = sid
                signals_list.append(sig_copy)
    
    return jsonify({
        "signals": signals_list,
        "count": len(signals_list),
        "timestamp": datetime.now().isoformat()
    })


@app.route('/balance', methods=['GET'])
def balance():
    """Get balance information - matches Freqtrade API"""
    return jsonify({
        "currency": "USD",
        "value": 10000.0,
        "timestamp": datetime.now().isoformat()
    })


@app.route('/logs', methods=['GET'])
def logs():
    """Get recent logs - matches Freqtrade API"""
    logs_list = []
    for sid, status in strategy_status.items():
        logs_list.append({
            "timestamp": status.get('startedAt') or status.get('updatedAt', datetime.now().isoformat()),
            "level": "info",
            "message": f"Strategy {sid}: {status.get('status', 'unknown')}",
            "data": status
        })
    
    return jsonify(logs_list[-50:])


@app.route('/run', methods=['POST'])
def run():
    """Run a new strategy"""
    data = request.json or {}
    strategy_id = data.get('id') or f"strategy-{int(time.time())}"
    
    if strategy_id in running_strategies:
        return jsonify({"error": f"Strategy {strategy_id} is already running"}), 400
    
    config = data.get('config', {})
    strategy_configs[strategy_id] = config
    
    thread = threading.Thread(
        target=run_strategy,
        args=(strategy_id, config),
        daemon=True
    )
    thread.start()
    running_strategies[strategy_id] = thread
    
    strategy_status[strategy_id] = {
        "status": "running",
        "startedAt": datetime.now().isoformat(),
        "config": config
    }
    
    return jsonify({
        "id": strategy_id,
        "status": "started"
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
