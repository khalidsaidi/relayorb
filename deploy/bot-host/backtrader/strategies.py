"""
Backtrader strategy definitions
"""

import backtrader as bt


class SignalCollector(bt.Strategy):
    """Strategy that collects signals from indicators"""
    
    params = (
        ('rsi_period', 14),
        ('sma_period', 20),
    )
    
    def __init__(self):
        self.rsi = bt.indicators.RSI(self.data.close, period=self.params.rsi_period)
        self.sma = bt.indicators.SMA(self.data.close, period=self.params.sma_period)
        self.signals = []
        self.last_signal_time = None
        
    def next(self):
        """Called for each bar"""
        current_price = self.data.close[0]
        rsi_value = self.rsi[0]
        sma_value = self.sma[0]

        if len(self) < 2:
            return

        prev_price = self.data.close[-1]
        prev_sma = self.sma[-1]
        crossed_above = prev_price <= prev_sma and current_price > sma_value
        crossed_below = prev_price >= prev_sma and current_price < sma_value
        
        # Generate signals
        signal = None
        side = None
        strength = 0.0
        message = ""
        
        # Oversold + Price above SMA = Buy
        if rsi_value < 35:
            side = "buy"
            strength = 0.75
            message = f"RSI oversold ({rsi_value:.1f}), price {current_price:.2f}"
        # Overbought + Price below SMA = Sell
        elif rsi_value > 65:
            side = "sell"
            strength = 0.75
            message = f"RSI overbought ({rsi_value:.1f}), price {current_price:.2f}"
        # SMA cross confirmation for more frequent signals
        elif crossed_above and rsi_value < 60:
            side = "buy"
            strength = 0.55
            message = f"SMA20 cross up ({sma_value:.2f}), RSI {rsi_value:.1f}"
        elif crossed_below and rsi_value > 40:
            side = "sell"
            strength = 0.55
            message = f"SMA20 cross down ({sma_value:.2f}), RSI {rsi_value:.1f}"
        
        if side:
            # Avoid duplicate signals within 30 minutes
            now = self.data.datetime.datetime(0)
            if not self.last_signal_time or (now - self.last_signal_time).total_seconds() > 1800:
                signal = {
                    "side": side,
                    "strength": strength,
                    "message": message,
                    "price": float(current_price),
                    "rsi": float(rsi_value),
                    "sma": float(sma_value),
                    "timestamp": now.isoformat()
                }
                self.signals.append(signal)
                self.last_signal_time = now


def create_strategy(strategy_name: str = 'default'):
    """Create a strategy class by name"""
    return SignalCollector
