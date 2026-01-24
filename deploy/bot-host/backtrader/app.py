"""
Backtrader REST API Service
Runs on the bot host VM
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import backtrader as bt
import threading
import time
from datetime import datetime
import logging
from typing import Dict, List
import os

try:
    from google.cloud import firestore
except Exception:  # pragma: no cover - optional dependency
    firestore = None

from datafeeds import get_datafeed, get_live_datafeed
from strategies import create_strategy

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global state
cerebro_instances: Dict[str, bt.Cerebro] = {}
running_strategies: Dict[str, List[threading.Thread]] = {}
strategy_signals: Dict[str, List[Dict]] = {}
strategy_status: Dict[str, Dict] = {}
strategy_configs: Dict[str, Dict] = {}
signals_lock = threading.Lock()
status_lock = threading.Lock()
SIGNAL_LIMIT = int(os.environ.get("BACKTRADER_SIGNAL_LIMIT", "500"))

def init_firestore():
    if not firestore:
        logger.warning("Firestore client not available; skipping backtrader heartbeat.")
        return None
    project_id = (
        os.environ.get("FIREBASE_PROJECT_ID")
        or os.environ.get("GOOGLE_CLOUD_PROJECT")
        or os.environ.get("GCLOUD_PROJECT")
        or "relayorb"
    )
    try:
        return firestore.Client(project=project_id)
    except Exception as err:
        logger.warning("Failed to initialize Firestore client: %s", err)
        return None

def build_health_payload():
    return {
        "service": "backtrader",
        "status": "ok",
        "activeStrategies": len([s for s in strategy_status.values() if s.get("status") == "running"]),
        "totalStrategies": len(strategy_status),
    }

def heartbeat_loop():
    db = init_firestore()
    if not db:
        return
    interval_s = int(os.environ.get("BACKTRADER_HEARTBEAT_SECONDS", "60"))
    while True:
        payload = build_health_payload()
        try:
            db.document("pipeline/backtrader").set(
                {**payload, "heartbeatAt": firestore.SERVER_TIMESTAMP},
                merge=True,
            )
        except Exception as err:
            logger.warning("Backtrader heartbeat write failed: %s", err)
        time.sleep(max(10, interval_s))

def resolve_symbols(config: Dict) -> List[str]:
    symbols = config.get("symbols") or []
    if isinstance(symbols, str):
        symbols = [sym.strip() for sym in symbols.split(",") if sym.strip()]
    symbol = config.get("symbol")
    if not symbols and symbol:
        symbols = [symbol]
    return [sym for sym in symbols if sym]


def record_signal(strategy_id: str, signal: Dict):
    if not signal:
        return
    with signals_lock:
        signals = strategy_signals.setdefault(strategy_id, [])
        signals.append(signal)
        if SIGNAL_LIMIT > 0 and len(signals) > SIGNAL_LIMIT:
            strategy_signals[strategy_id] = signals[-SIGNAL_LIMIT:]
        signals_count = len(strategy_signals[strategy_id])
    with status_lock:
        status = strategy_status.get(strategy_id, {})
        status["signalsCount"] = signals_count
        status["lastSignalAt"] = signal.get("timestamp") or datetime.now().isoformat()
        strategy_status[strategy_id] = status


def build_strategy_params(strategy_id: str, config: Dict, symbol: str):
    params = {
        "asset_class": config.get("assetClass", "stock"),
        "timeframe": config.get("timeframe", "1d"),
        "symbol": symbol,
        "strategy_name": config.get("strategy", "default"),
        "signal_callback": lambda sig: record_signal(strategy_id, sig),
    }
    overrides = {
        "horizonBars": "horizon_bars",
        "stopAtrMult": "stop_atr_mult",
        "targetAtrMult": "target_atr_mult",
        "minRewardRisk": "min_reward_risk",
        "minSignalGapSeconds": "min_signal_gap_seconds",
        "tradeSizePct": "trade_size_pct",
        "allowShort": "allow_short",
    }
    for key, target in overrides.items():
        if key in config:
            params[target] = config.get(key)
    return params


def safe_get(data, path, default=None):
    current = data
    for key in path:
        if not isinstance(current, dict):
            return default
        current = current.get(key)
    return default if current is None else current


def compute_backtest_score(metrics: Dict) -> float:
    return_pct = metrics.get("returnPct") or 0.0
    sharpe = metrics.get("sharpe") or 0.0
    win_rate = metrics.get("winRate") or 0.0
    max_dd = metrics.get("maxDrawdownPct") or 0.0
    profit_factor = metrics.get("profitFactor")

    score = 0.0
    score += max(min(return_pct, 50.0), -50.0) * 0.4
    score += max(min(sharpe, 3.0), -2.0) * 10.0 * 0.25
    score += max(min(win_rate, 1.0), 0.0) * 100.0 * 0.2
    score -= max(min(max_dd, 60.0), 0.0) * 0.15
    if profit_factor is not None:
        score += max(min((profit_factor - 1.0) * 10.0, 10.0), -10.0) * 0.1
    return round(score, 2)

def run_strategy(strategy_id: str, config: Dict):
    """Run a Backtrader strategy in a separate thread"""
    mode = (config.get("mode") or "signal").lower()
    if mode == "live":
        run_live_strategy(strategy_id, config)
        return
    run_batch_strategy(strategy_id, config)


def run_batch_strategy(strategy_id: str, config: Dict):
    try:
        logger.info("Starting strategy %s with config: %s", strategy_id, config)

        symbols = resolve_symbols(config)
        if not symbols:
            raise ValueError("Symbol or symbols required")

        asset_class = config.get("assetClass", "stock")
        timeframe = config.get("timeframe", "1d")
        mode = config.get("mode", "signal")
        history_days = int(config.get("historyDays", 100))

        with signals_lock:
            strategy_signals[strategy_id] = []

        for sym in symbols:
            try:
                datafeed = get_datafeed(sym, asset_class, timeframe, history_days)
                if datafeed is None:
                    logger.warning("Could not get data feed for %s, skipping", sym)
                    continue

                sym_cerebro = bt.Cerebro()
                sym_cerebro.adddata(datafeed, name=sym)

                strategy_class = create_strategy(
                    config.get("strategy", "default"),
                    asset_class=asset_class,
                    mode=mode,
                )
                sym_cerebro.addstrategy(strategy_class, **build_strategy_params(strategy_id, config, sym))

                sym_cerebro.broker.setcash(config.get("initialCash", 10000.0))
                sym_cerebro.broker.setcommission(commission=config.get("commission", 0.001))

                logger.info("Running strategy for %s...", sym)
                try:
                    results = sym_cerebro.run()
                    if results and len(results) > 0:
                        strategy = results[0]
                        if hasattr(strategy, "signals") and strategy.signals:
                            logger.info(
                                "Strategy for %s generated %s signals",
                                sym,
                                len(strategy.signals),
                            )
                        else:
                            logger.info("Strategy for %s completed but no signals generated", sym)
                except Exception as run_err:
                    logger.error("Error running cerebro for %s: %s", sym, run_err, exc_info=True)
                    continue

            except Exception as e:
                logger.error("Error processing %s: %s", sym, e, exc_info=True)
                continue

        signals_count = len(strategy_signals.get(strategy_id, []))
        with status_lock:
            strategy_status[strategy_id] = {
                "status": "completed",
                "completedAt": datetime.now().isoformat(),
                "signalsCount": signals_count,
                "symbolsProcessed": len(symbols),
            }
    except Exception as e:
        logger.error("Error running strategy %s: %s", strategy_id, str(e), exc_info=True)
        with status_lock:
            strategy_status[strategy_id] = {
                "status": "error",
                "error": str(e),
                "updatedAt": datetime.now().isoformat(),
            }


def run_live_symbol(strategy_id: str, config: Dict, symbol: str):
    try:
        asset_class = config.get("assetClass", "stock")
        timeframe = config.get("timeframe", "1m")
        history_days = int(config.get("historyDays", 120))
        poll_seconds = int(config.get("livePollSeconds", 5))
        price_source = config.get("livePriceSource", "price_streamer")
        mode = config.get("mode", "live")

        datafeed = get_live_datafeed(
            symbol,
            asset_class,
            timeframe=timeframe,
            history_days=history_days,
            poll_interval=poll_seconds,
            price_source=price_source,
        )
        if datafeed is None:
            raise ValueError(f"Could not get live data feed for {symbol}")

        sym_cerebro = bt.Cerebro()
        sym_cerebro.adddata(datafeed, name=symbol)

        strategy_class = create_strategy(
            config.get("strategy", "default"),
            asset_class=asset_class,
            mode=mode,
        )
        sym_cerebro.addstrategy(strategy_class, **build_strategy_params(strategy_id, config, symbol))

        sym_cerebro.broker.setcash(config.get("initialCash", 10000.0))
        sym_cerebro.broker.setcommission(commission=config.get("commission", 0.001))

        cerebro_instances[f"{strategy_id}:{symbol}"] = sym_cerebro
        sym_cerebro.run(runonce=False, stdstats=False, preload=False)
    except Exception as err:
        logger.error("Live strategy %s/%s failed: %s", strategy_id, symbol, err, exc_info=True)
        with status_lock:
            strategy_status[strategy_id] = {
                "status": "error",
                "error": str(err),
                "updatedAt": datetime.now().isoformat(),
            }


def run_live_strategy(strategy_id: str, config: Dict):
    try:
        logger.info("Starting live strategy %s with config: %s", strategy_id, config)
        symbols = resolve_symbols(config)
        if not symbols:
            raise ValueError("Symbol or symbols required")
        with signals_lock:
            strategy_signals[strategy_id] = []
        threads = []
        for sym in symbols:
            thread = threading.Thread(
                target=run_live_symbol,
                args=(strategy_id, config, sym),
                daemon=True,
            )
            thread.start()
            threads.append(thread)
        running_strategies[strategy_id] = threads
        with status_lock:
            strategy_status[strategy_id] = {
                "status": "running",
                "startedAt": datetime.now().isoformat(),
                "mode": "live",
                "symbols": symbols,
            }
    except Exception as err:
        logger.error("Live strategy %s failed: %s", strategy_id, err, exc_info=True)
        with status_lock:
            strategy_status[strategy_id] = {
                "status": "error",
                "error": str(err),
                "updatedAt": datetime.now().isoformat(),
            }


def summarize_backtest(symbol: str, strategy, initial_cash: float, final_value: float, signals_count: int):
    trade_analysis = strategy.analyzers.trades.get_analysis() if hasattr(strategy, "analyzers") else {}
    total_trades = safe_get(trade_analysis, ("total", "total"), 0)
    won_trades = safe_get(trade_analysis, ("won", "total"), 0)
    lost_trades = safe_get(trade_analysis, ("lost", "total"), 0)
    win_rate = (won_trades / total_trades) if total_trades else None
    gross_profit = safe_get(trade_analysis, ("won", "pnl", "total"), 0.0)
    gross_loss = safe_get(trade_analysis, ("lost", "pnl", "total"), 0.0)
    profit_factor = (
        float(gross_profit) / abs(float(gross_loss))
        if gross_loss not in (None, 0, 0.0)
        else None
    )

    returns_analysis = strategy.analyzers.returns.get_analysis() if hasattr(strategy, "analyzers") else {}
    return_pct = returns_analysis.get("rnorm100")
    if return_pct is None:
        pnl = final_value - initial_cash
        return_pct = (pnl / initial_cash) * 100 if initial_cash else 0.0
    pnl_value = final_value - initial_cash

    drawdown_analysis = strategy.analyzers.drawdown.get_analysis() if hasattr(strategy, "analyzers") else {}
    max_drawdown = safe_get(drawdown_analysis, ("max", "drawdown"), 0.0)

    sharpe_analysis = strategy.analyzers.sharpe.get_analysis() if hasattr(strategy, "analyzers") else {}
    sharpe_ratio = sharpe_analysis.get("sharperatio") if isinstance(sharpe_analysis, dict) else None

    sqn_analysis = strategy.analyzers.sqn.get_analysis() if hasattr(strategy, "analyzers") else {}
    sqn = sqn_analysis.get("sqn") if isinstance(sqn_analysis, dict) else None

    metrics = {
        "symbol": symbol,
        "initialCash": round(float(initial_cash), 2),
        "finalValue": round(float(final_value), 2),
        "pnl": round(float(pnl_value), 2),
        "returnPct": round(float(return_pct), 2) if return_pct is not None else None,
        "totalTrades": int(total_trades or 0),
        "winRate": round(float(win_rate), 3) if win_rate is not None else None,
        "profitFactor": round(float(profit_factor), 3) if profit_factor is not None else None,
        "maxDrawdownPct": round(float(max_drawdown), 2) if max_drawdown is not None else None,
        "sharpe": round(float(sharpe_ratio), 3) if sharpe_ratio is not None else None,
        "sqn": round(float(sqn), 3) if sqn is not None else None,
        "signalsCount": signals_count,
    }
    metrics["score"] = compute_backtest_score(metrics)
    return metrics


def run_backtest(config: Dict):
    symbols = resolve_symbols(config)
    if not symbols:
        raise ValueError("Symbol or symbols required")
    asset_class = config.get("assetClass", "stock")
    timeframe = config.get("timeframe", "1d")
    history_days = int(config.get("historyDays", 200))
    include_signals = bool(config.get("includeSignals"))
    results = []

    for sym in symbols:
        try:
            datafeed = get_datafeed(sym, asset_class, timeframe, history_days)
            if datafeed is None:
                results.append({"symbol": sym, "error": "No data feed available"})
                continue

            cerebro = bt.Cerebro()
            cerebro.adddata(datafeed, name=sym)

            local_signals = []
            strategy_class = create_strategy(
                config.get("strategy", "default"),
                asset_class=asset_class,
                mode="backtest",
            )
            params = build_strategy_params("backtest", config, sym)
            params["signal_callback"] = local_signals.append
            cerebro.addstrategy(strategy_class, **params)

            initial_cash = float(config.get("initialCash", 10000.0))
            cerebro.broker.setcash(initial_cash)
            cerebro.broker.setcommission(commission=config.get("commission", 0.001))

            cerebro.addanalyzer(bt.analyzers.TradeAnalyzer, _name="trades")
            cerebro.addanalyzer(bt.analyzers.SharpeRatio, _name="sharpe", timeframe=bt.TimeFrame.Days)
            cerebro.addanalyzer(bt.analyzers.DrawDown, _name="drawdown")
            cerebro.addanalyzer(bt.analyzers.Returns, _name="returns")
            cerebro.addanalyzer(bt.analyzers.SQN, _name="sqn")

            results_list = cerebro.run()
            strategy = results_list[0]
            final_value = cerebro.broker.getvalue()
            metrics = summarize_backtest(sym, strategy, initial_cash, final_value, len(local_signals))
            if include_signals:
                metrics["signals"] = local_signals
            results.append(metrics)
        except Exception as err:
            logger.error("Backtest error for %s: %s", sym, err, exc_info=True)
            results.append({"symbol": sym, "error": str(err)})

    return results


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
    """Get balance information - RelayOrb agent compatibility"""
    return jsonify({
        "currency": "USD",
        "value": 10000.0,
        "timestamp": datetime.now().isoformat()
    })


@app.route('/logs', methods=['GET'])
def logs():
    """Get recent logs - RelayOrb agent compatibility"""
    logs_list = []
    for sid, status in strategy_status.items():
        logs_list.append({
            "timestamp": status.get('startedAt') or status.get('updatedAt', datetime.now().isoformat()),
            "level": "info",
            "message": f"Strategy {sid}: {status.get('status', 'unknown')}",
            "data": status
        })
    
    return jsonify(logs_list[-50:])


@app.route('/backtest', methods=['POST'])
def backtest():
    """Run a backtest and return scoring metrics"""
    data = request.json or {}
    config = data.get("config") if isinstance(data, dict) else None
    if not isinstance(config, dict):
        config = data if isinstance(data, dict) else {}
    try:
        results = run_backtest(config)
        return jsonify({
            "results": results,
            "count": len(results),
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as err:
        logger.error("Backtest failed: %s", err, exc_info=True)
        return jsonify({"error": str(err)}), 400


@app.route('/run', methods=['POST'])
def run():
    """Run a new strategy"""
    data = request.json or {}
    strategy_id = data.get('id') or f"strategy-{int(time.time())}"
    
    if strategy_id in running_strategies:
        return jsonify({"error": f"Strategy {strategy_id} is already running"}), 400
    
    config = data.get('config', {})
    strategy_configs[strategy_id] = config
    mode = (config.get("mode") or "signal").lower()
    
    thread = threading.Thread(
        target=run_strategy,
        args=(strategy_id, config),
        daemon=True
    )
    thread.start()
    running_strategies[strategy_id] = [thread]
    
    strategy_status[strategy_id] = {
        "status": "running",
        "startedAt": datetime.now().isoformat(),
        "mode": mode,
        "config": config
    }
    
    return jsonify({
        "id": strategy_id,
        "status": "started"
    })


if __name__ == '__main__':
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
