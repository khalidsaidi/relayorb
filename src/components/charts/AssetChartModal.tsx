import { useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MarketHotTrade } from '@/lib/types'

type AssetChartModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: MarketHotTrade | null
}

/**
 * Normalizes symbol for TradingView widget
 * TradingView supports:
 * - Stocks: Exchange:SYMBOL (NASDAQ:AAPL, NYSE:MSFT) or just SYMBOL
 * - Crypto: Exchange:SYMBOL (BINANCE:BTCUSDT, COINBASE:ETHUSD)
 * - Forex: OANDA:EURUSD, FX:EURUSD, or FX_IDC:EURUSD
 */
function normalizeSymbolForTradingView(
  symbol: string,
  assetClass: string,
  exchange?: string | null
): string {
  const trimmed = symbol.trim().toUpperCase()
  
  if (assetClass === 'stock') {
    // Stocks: Try exchange prefix, fallback to symbol only
    // TradingView will auto-detect exchange if symbol is well-known
    const cleanSymbol = trimmed.replace(/\//g, '').replace(/-/g, '')
    
    // For well-known stocks, just use the symbol (TradingView auto-detects)
    // For less common ones, you might want to add exchange prefix
    return cleanSymbol
  } else if (assetClass === 'crypto') {
    // Crypto: Use exchange prefix (default BINANCE). Convert USD -> USDT for Binance pairs.
    const exchangeHint = (exchange || '').toUpperCase()
    const exchangePrefix = exchangeHint.includes('COINBASE')
      ? 'COINBASE'
      : exchangeHint.includes('KRAKEN')
        ? 'KRAKEN'
        : exchangeHint.includes('BITSTAMP')
          ? 'BITSTAMP'
          : 'BINANCE'

    // If already has exchange prefix, keep it.
    if (trimmed.includes(':')) {
      return trimmed
    }

    let base = trimmed
    let quote = ''

    if (trimmed.includes('/') || trimmed.includes('-')) {
      const parts = trimmed.replace('-', '/').split('/').filter(Boolean)
      if (parts.length === 2) {
        base = parts[0]
        quote = parts[1]
      }
    } else {
      const quotes = ['USDT', 'USDC', 'USD', 'BTC', 'ETH', 'EUR']
      for (const q of quotes) {
        if (trimmed.endsWith(q) && trimmed.length > q.length) {
          base = trimmed.slice(0, -q.length)
          quote = q
          break
        }
      }
    }

    if (!quote) {
      return `${exchangePrefix}:${base}`
    }
    if (quote === 'USD' && exchangePrefix === 'BINANCE') {
      quote = 'USDT'
    }
    return `${exchangePrefix}:${base}${quote}`
  } else if (assetClass === 'forex') {
    // Forex: Use OANDA: prefix or FX: prefix
    const cleanSymbol = trimmed.replace('/', '').replace('-', '')
    // If already has prefix, keep it
    if (cleanSymbol.includes(':')) {
      return cleanSymbol
    }
    // Default to OANDA for forex
    return `OANDA:${cleanSymbol}`
  }
  
  return trimmed.replace(/\//g, '').replace(/-/g, '')
}

export function AssetChartModal({ open, onOpenChange, asset }: AssetChartModalProps) {
  // Generate TradingView widget URL
  const chartUrl = useMemo(() => {
    if (!asset?.symbol) return ''
    
    const symbol = normalizeSymbolForTradingView(
      asset.symbol,
      asset.assetClass,
      asset.exchange
    )
    
    // TradingView Advanced Chart widget
    const params = new URLSearchParams({
      symbol,
      interval: '5', // Default to 5 minutes, user can change in TradingView
      theme: 'dark',
      style: '1', // Candlestick
      locale: 'en',
      toolbar_bg: 'rgba(0,0,0,0)',
      enable_publishing: 'false',
      hide_top_toolbar: 'false',
      hide_legend: 'false',
      save_image: 'false',
      container_id: 'tradingview_chart',
      autosize: 'true',
      studies: '', // No studies by default
      width: '100%',
      height: '100%',
    })
    
    return `https://www.tradingview.com/widgetembed/?${params.toString()}`
  }, [asset])

  if (!asset) return null

  const displaySymbol = asset.symbol

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] max-h-[90vh] flex flex-col p-4 gap-4" showCloseButton={true}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {displaySymbol} Chart - {asset.assetClass.toUpperCase()}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Interactive TradingView price chart for {displaySymbol}
          </DialogDescription>
        </DialogHeader>

        {/* TradingView Widget - Takes remaining space but leaves room for asset info */}
        <div className="relative w-full flex-1 min-h-0 border rounded-lg bg-background overflow-hidden" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {chartUrl ? (
            <iframe
              src={chartUrl}
              className="w-full h-full border-0"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              title={`TradingView chart for ${displaySymbol}`}
              allow="clipboard-write"
              loading="lazy"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              No chart data available
            </div>
          )}
        </div>

        {/* Asset Info - Always visible at bottom */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm flex-shrink-0 bg-muted/30 rounded-lg p-4">
          <div>
            <div className="text-muted-foreground mb-1">Current Price</div>
            <div className="font-semibold text-lg">
              {asset.price
                ? asset.price.toFixed(asset.assetClass === 'forex' ? 5 : asset.price < 1 ? 4 : 2)
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">24h Change</div>
            <div className={`font-semibold text-lg ${asset.momentum?.change24h && asset.momentum.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {asset.momentum?.change24h
                ? `${asset.momentum.change24h >= 0 ? '+' : ''}${asset.momentum.change24h.toFixed(2)}%`
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Score</div>
            <div className="font-semibold text-lg">{asset.score?.toFixed(1) ?? '—'}</div>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">Side</div>
            <div className={`font-semibold text-lg uppercase ${asset.side?.toUpperCase() === 'BUY' ? 'text-green-600' : asset.side?.toUpperCase() === 'SELL' ? 'text-red-600' : ''}`}>
              {asset.side ?? '—'}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
