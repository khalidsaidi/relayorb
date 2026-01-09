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
        
        # Generate signals
        signal = None
        side = None
        strength = 0.0
        message = ""
        
        # Oversold + Price above SMA = Buy
        if rsi_value < 30 and current_price > sma_value:
            side = "buy"
            strength = 0.75
            message = f"RSI oversold ({rsi_value:.1f}), price above SMA20 ({sma_value:.2f})"
        # Overbought + Price below SMA = Sell
        elif rsi_value > 70 and current_price < sma_value:
            side = "sell"
            strength = 0.75
            message = f"RSI overbought ({rsi_value:.1f}), price below SMA20 ({sma_value:.2f})"
        
        if side:
            # Avoid duplicate signals within 1 hour
            now = self.data.datetime.datetime(0)
            if not self.last_signal_time or (now - self.last_signal_time).total_seconds() > 3600:
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
