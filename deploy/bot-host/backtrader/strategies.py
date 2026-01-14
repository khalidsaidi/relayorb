"""
Backtrader strategy definitions - Enhanced multi-indicator analysis
Provides comprehensive technical analysis signals for stocks, crypto, and forex
"""

import backtrader as bt
import math


class MultiIndicatorStrategy(bt.Strategy):
    """
    Advanced multi-indicator strategy that combines:
    - RSI (momentum oscillator)
    - MACD (trend following)
    - Bollinger Bands (volatility)
    - Volume analysis (confirmation)
    - ATR (volatility-adjusted stops)
    - Stochastic oscillator (overbought/oversold)
    
    Signal strength is calculated based on indicator confluence.
    """
    
    params = (
        # RSI parameters
        ('rsi_period', 14),
        ('rsi_oversold', 30),
        ('rsi_overbought', 70),
        # MACD parameters
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        # Bollinger Bands
        ('bb_period', 20),
        ('bb_dev', 2.0),
        # Moving averages
        ('sma_fast', 10),
        ('sma_slow', 50),
        # Stochastic
        ('stoch_period', 14),
        ('stoch_smooth', 3),
        # Volume
        ('volume_sma_period', 20),
        # ATR
        ('atr_period', 14),
        # Signal generation
        ('min_signal_gap_seconds', 900),  # 15 minutes between signals
        ('asset_class', 'stock'),
    )
    
    def __init__(self):
        # Core indicators
        self.rsi = bt.indicators.RSI(
            self.data.close, 
            period=self.params.rsi_period
        )
        
        self.macd = bt.indicators.MACD(
            self.data.close,
            period_me1=self.params.macd_fast,
            period_me2=self.params.macd_slow,
            period_signal=self.params.macd_signal
        )
        
        self.bb = bt.indicators.BollingerBands(
            self.data.close,
            period=self.params.bb_period,
            devfactor=self.params.bb_dev
        )
        
        self.sma_fast = bt.indicators.SMA(
            self.data.close, 
            period=self.params.sma_fast
        )
        self.sma_slow = bt.indicators.SMA(
            self.data.close, 
            period=self.params.sma_slow
        )
        
        self.stoch = bt.indicators.Stochastic(
            self.data,
            period=self.params.stoch_period,
            period_dfast=self.params.stoch_smooth
        )
        
        self.atr = bt.indicators.ATR(
            self.data, 
            period=self.params.atr_period
        )
        
        # Volume analysis
        self.volume_sma = bt.indicators.SMA(
            self.data.volume, 
            period=self.params.volume_sma_period
        )
        
        # Signal storage
        self.signals = []
        self.last_signal_time = None
        
    def _calculate_volume_ratio(self):
        """Calculate current volume relative to average"""
        if self.volume_sma[0] > 0:
            return self.data.volume[0] / self.volume_sma[0]
        return 1.0
    
    def _calculate_bb_position(self):
        """Calculate price position within Bollinger Bands (-1 to 1)"""
        bb_range = self.bb.top[0] - self.bb.bot[0]
        if bb_range > 0:
            position = (self.data.close[0] - self.bb.bot[0]) / bb_range
            return (position - 0.5) * 2  # Normalize to -1 to 1
        return 0
    
    def _get_macd_signal(self):
        """Analyze MACD for trend direction"""
        macd_line = self.macd.macd[0]
        signal_line = self.macd.signal[0]
        histogram = macd_line - signal_line
        
        # Check for crossover
        if len(self) < 2:
            return 0, False
            
        prev_hist = self.macd.macd[-1] - self.macd.signal[-1]
        
        # Bullish crossover
        if prev_hist <= 0 and histogram > 0:
            return 1, True
        # Bearish crossover
        elif prev_hist >= 0 and histogram < 0:
            return -1, True
        # Continuation
        elif histogram > 0:
            return 0.5, False
        elif histogram < 0:
            return -0.5, False
        return 0, False
    
    def _get_rsi_signal(self):
        """Analyze RSI for momentum"""
        rsi = self.rsi[0]
        
        if rsi < self.params.rsi_oversold:
            # Strong oversold - buy signal
            strength = (self.params.rsi_oversold - rsi) / self.params.rsi_oversold
            return 1, min(strength * 1.5, 1.0)
        elif rsi > self.params.rsi_overbought:
            # Strong overbought - sell signal
            strength = (rsi - self.params.rsi_overbought) / (100 - self.params.rsi_overbought)
            return -1, min(strength * 1.5, 1.0)
        elif rsi < 40:
            return 0.3, 0.3
        elif rsi > 60:
            return -0.3, 0.3
        return 0, 0
    
    def _get_stochastic_signal(self):
        """Analyze Stochastic oscillator"""
        k = self.stoch.percK[0]
        d = self.stoch.percD[0]
        
        if k < 20 and d < 20:
            return 1, 0.7
        elif k > 80 and d > 80:
            return -1, 0.7
        elif k < 30:
            return 0.5, 0.4
        elif k > 70:
            return -0.5, 0.4
        return 0, 0
    
    def _get_bollinger_signal(self):
        """Analyze Bollinger Bands for mean reversion"""
        price = self.data.close[0]
        
        # Price below lower band - potential buy
        if price < self.bb.bot[0]:
            distance = (self.bb.bot[0] - price) / self.bb.bot[0]
            return 1, min(distance * 10, 1.0)
        # Price above upper band - potential sell
        elif price > self.bb.top[0]:
            distance = (price - self.bb.top[0]) / self.bb.top[0]
            return -1, min(distance * 10, 1.0)
        return 0, 0
    
    def _get_trend_signal(self):
        """Analyze moving average crossover for trend"""
        if len(self) < 2:
            return 0, False
            
        # Current state
        fast_above = self.sma_fast[0] > self.sma_slow[0]
        # Previous state
        prev_fast_above = self.sma_fast[-1] > self.sma_slow[-1]
        
        # Golden cross (bullish)
        if fast_above and not prev_fast_above:
            return 1, True
        # Death cross (bearish)
        elif not fast_above and prev_fast_above:
            return -1, True
        # Trend continuation
        elif fast_above:
            return 0.3, False
        else:
            return -0.3, False
    
    def next(self):
        """Evaluate all indicators and generate composite signal"""
        if len(self) < max(self.params.sma_slow, self.params.bb_period) + 5:
            return
        
        current_price = self.data.close[0]
        now = self.data.datetime.datetime(0)
        
        # Check signal gap
        if self.last_signal_time:
            gap_seconds = (now - self.last_signal_time).total_seconds()
            if gap_seconds < self.params.min_signal_gap_seconds:
                return
        
        # Collect all indicator signals
        rsi_dir, rsi_strength = self._get_rsi_signal()
        macd_dir, macd_crossover = self._get_macd_signal()
        stoch_dir, stoch_strength = self._get_stochastic_signal()
        bb_dir, bb_strength = self._get_bollinger_signal()
        trend_dir, trend_crossover = self._get_trend_signal()
        volume_ratio = self._calculate_volume_ratio()
        
        # Weight the signals based on reliability
        weights = {
            'rsi': 0.20,
            'macd': 0.25,
            'stoch': 0.15,
            'bb': 0.15,
            'trend': 0.25,
        }
        
        # Calculate weighted direction
        weighted_sum = (
            rsi_dir * weights['rsi'] +
            macd_dir * weights['macd'] +
            stoch_dir * weights['stoch'] +
            bb_dir * weights['bb'] +
            trend_dir * weights['trend']
        )
        
        # Calculate confidence based on agreement
        signals_agree = sum([
            1 if rsi_dir > 0 else (-1 if rsi_dir < 0 else 0),
            1 if macd_dir > 0 else (-1 if macd_dir < 0 else 0),
            1 if stoch_dir > 0 else (-1 if stoch_dir < 0 else 0),
            1 if bb_dir > 0 else (-1 if bb_dir < 0 else 0),
            1 if trend_dir > 0 else (-1 if trend_dir < 0 else 0),
        ])
        
        # Need at least 3 indicators agreeing for strong signal
        confluence = abs(signals_agree) >= 3
        
        # Determine if we should generate a signal
        signal_threshold = 0.25  # Minimum weighted sum to generate signal
        
        if abs(weighted_sum) < signal_threshold:
            return
        
        side = "buy" if weighted_sum > 0 else "sell"
        
        # Calculate strength (0.0 to 1.0)
        base_strength = min(abs(weighted_sum) * 2, 1.0)
        
        # Boost strength for confluence
        if confluence:
            base_strength = min(base_strength * 1.3, 1.0)
        
        # Boost strength for crossover events
        if macd_crossover or trend_crossover:
            base_strength = min(base_strength * 1.2, 1.0)
        
        # Volume confirmation boost
        if volume_ratio > 1.5:
            base_strength = min(base_strength * 1.15, 1.0)
        
        # Build detailed message
        indicators = []
        if abs(rsi_dir) > 0:
            rsi_status = "oversold" if rsi_dir > 0 else "overbought"
            indicators.append(f"RSI {self.rsi[0]:.1f} ({rsi_status})")
        
        if macd_crossover:
            macd_status = "bullish cross" if macd_dir > 0 else "bearish cross"
            indicators.append(f"MACD {macd_status}")
        elif abs(macd_dir) > 0:
            indicators.append(f"MACD {'positive' if macd_dir > 0 else 'negative'}")
        
        if abs(bb_dir) > 0:
            bb_status = "below lower" if bb_dir > 0 else "above upper"
            indicators.append(f"BB {bb_status}")
        
        if trend_crossover:
            trend_status = "golden cross" if trend_dir > 0 else "death cross"
            indicators.append(f"MA {trend_status}")
        
        if volume_ratio > 1.5:
            indicators.append(f"vol {volume_ratio:.1f}x avg")
        
        message = f"{side.upper()}: {', '.join(indicators[:4])}"
        
        signal = {
            "side": side,
            "strength": round(base_strength, 3),
            "message": message,
            "price": float(current_price),
            "timestamp": now.isoformat(),
            "indicators": {
                "rsi": round(float(self.rsi[0]), 2),
                "macd": round(float(self.macd.macd[0]), 4),
                "macd_signal": round(float(self.macd.signal[0]), 4),
                "macd_histogram": round(float(self.macd.macd[0] - self.macd.signal[0]), 4),
                "bb_upper": round(float(self.bb.top[0]), 4),
                "bb_lower": round(float(self.bb.bot[0]), 4),
                "bb_middle": round(float(self.bb.mid[0]), 4),
                "sma_fast": round(float(self.sma_fast[0]), 4),
                "sma_slow": round(float(self.sma_slow[0]), 4),
                "stoch_k": round(float(self.stoch.percK[0]), 2),
                "stoch_d": round(float(self.stoch.percD[0]), 2),
                "atr": round(float(self.atr[0]), 4),
                "volume_ratio": round(volume_ratio, 2),
            },
            "confluence": confluence,
            "crossover": macd_crossover or trend_crossover,
        }
        
        self.signals.append(signal)
        self.last_signal_time = now


class CryptoMomentumStrategy(MultiIndicatorStrategy):
    """
    Crypto-optimized strategy with adjusted parameters for 24/7 markets
    and higher volatility.
    """
    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 25),  # More aggressive for crypto volatility
        ('rsi_overbought', 75),
        ('macd_fast', 8),  # Faster for crypto
        ('macd_slow', 21),
        ('macd_signal', 9),
        ('bb_period', 20),
        ('bb_dev', 2.5),  # Wider bands for crypto volatility
        ('sma_fast', 8),
        ('sma_slow', 34),  # Fibonacci-based
        ('stoch_period', 14),
        ('stoch_smooth', 3),
        ('volume_sma_period', 14),
        ('atr_period', 14),
        ('min_signal_gap_seconds', 600),  # 10 minutes for faster crypto markets
        ('asset_class', 'crypto'),
    )


class ForexScalpStrategy(MultiIndicatorStrategy):
    """
    Forex-optimized strategy for major pairs, accounting for
    lower volatility and session-based movements.
    """
    params = (
        ('rsi_period', 14),
        ('rsi_oversold', 35),  # Tighter for forex
        ('rsi_overbought', 65),
        ('macd_fast', 12),
        ('macd_slow', 26),
        ('macd_signal', 9),
        ('bb_period', 20),
        ('bb_dev', 1.8),  # Narrower for forex
        ('sma_fast', 10),
        ('sma_slow', 50),
        ('stoch_period', 14),
        ('stoch_smooth', 3),
        ('volume_sma_period', 20),
        ('atr_period', 14),
        ('min_signal_gap_seconds', 1800),  # 30 minutes for forex
        ('asset_class', 'forex'),
    )


# Legacy strategy for backward compatibility
class SignalCollector(MultiIndicatorStrategy):
    """Legacy alias for MultiIndicatorStrategy"""
    pass


def create_strategy(strategy_name: str = 'default', asset_class: str = 'stock'):
    """
    Create a strategy class by name and asset class.
    
    Args:
        strategy_name: Strategy identifier ('default', 'momentum', 'scalp')
        asset_class: Asset type ('stock', 'crypto', 'forex')
    
    Returns:
        Strategy class appropriate for the asset class
    """
    # Asset-class specific strategies
    if asset_class == 'crypto':
        return CryptoMomentumStrategy
    elif asset_class == 'forex':
        return ForexScalpStrategy
    
    # Default to multi-indicator strategy
    return MultiIndicatorStrategy
