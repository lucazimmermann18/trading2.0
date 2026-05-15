import { useEffect, useState } from 'react'
import { fetchQuote } from '../api/twelvedata'
import CandlestickChart from './CandlestickChart'
import IndicatorsPanel from './IndicatorsPanel'
import type { Quote, TimeFrame } from '../types'

interface Props {
  symbol: string
  onSymbolChange: (sym: string) => void
}

const TIMEFRAMES: { label: string; value: TimeFrame }[] = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1D', value: '1day' },
  { label: '1W', value: '1week' },
]

const QUICK_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'GOOGL', 'META', 'BTC/USD', 'ETH/USD', 'SPY', 'AMD', 'QQQ']

export default function ChartsPage({ symbol, onSymbolChange }: Props) {
  const [interval, setInterval] = useState<TimeFrame>('1day')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [showEMA, setShowEMA] = useState(true)
  const [chartType, setChartType] = useState<'candle' | 'line'>('candle')
  const [customSymbol, setCustomSymbol] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const quotes = await fetchQuote([symbol])
        if (quotes[0]) setQuote(quotes[0])
      } catch {
        // silent
      }
    }
    load()
  }, [symbol])

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (customSymbol.trim()) {
      onSymbolChange(customSymbol.trim().toUpperCase())
      setCustomSymbol('')
    }
  }

  return (
    <div>
      {/* Quick symbol bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {QUICK_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => onSymbolChange(s)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              background: symbol === s ? 'var(--cyan)' : 'var(--bg-card)',
              color: symbol === s ? '#000' : 'var(--text-secondary)',
              border: `1px solid ${symbol === s ? 'var(--cyan)' : 'var(--border)'}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {s.replace('/USD', '')}
          </button>
        ))}
        <form onSubmit={handleCustomSearch} style={{ display: 'flex', gap: 4 }}>
          <input
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            placeholder="Symbol..."
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '5px 10px',
              color: 'var(--text-primary)',
              fontSize: 12,
              outline: 'none',
              width: 90,
            }}
          />
          <button
            type="submit"
            style={{
              padding: '5px 10px',
              borderRadius: 6,
              background: 'var(--cyan-dim)',
              color: 'var(--cyan)',
              border: '1px solid rgba(0,212,255,0.3)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Go
          </button>
        </form>
      </div>

      <div className="chart-section">
        <div className="chart-card">
          <div className="chart-toolbar">
            <div>
              <div className="chart-symbol">{symbol}</div>
              {quote && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <span className="chart-price-display">${quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className={`chart-change-display ${quote.changePercent >= 0 ? 'up' : 'down'}`}>
                    {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <div className="chart-spacer" />

            {/* Chart type */}
            <div className="chart-type-buttons">
              <button
                className={`chart-type-btn ${chartType === 'candle' ? 'active' : ''}`}
                onClick={() => setChartType('candle')}
                title="Candlestick"
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="6" width="4" height="12" rx="1" opacity="0.8"/>
                  <line x1="6" y1="2" x2="6" y2="6" stroke="currentColor" strokeWidth="2"/>
                  <line x1="6" y1="18" x2="6" y2="22" stroke="currentColor" strokeWidth="2"/>
                  <rect x="10" y="9" width="4" height="7" rx="1" opacity="0.8"/>
                  <line x1="12" y1="4" x2="12" y2="9" stroke="currentColor" strokeWidth="2"/>
                  <line x1="12" y1="16" x2="12" y2="21" stroke="currentColor" strokeWidth="2"/>
                  <rect x="16" y="5" width="4" height="10" rx="1" opacity="0.8"/>
                  <line x1="18" y1="2" x2="18" y2="5" stroke="currentColor" strokeWidth="2"/>
                  <line x1="18" y1="15" x2="18" y2="20" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </button>
              <button
                className={`chart-type-btn ${chartType === 'line' ? 'active' : ''}`}
                onClick={() => setChartType('line')}
                title="Line"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 17 9 11 13 15 21 7" />
                </svg>
              </button>
            </div>

            {/* EMA toggle */}
            <button
              onClick={() => setShowEMA(!showEMA)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 600,
                background: showEMA ? 'rgba(255,184,0,0.15)' : 'var(--bg-secondary)',
                color: showEMA ? 'var(--amber)' : 'var(--text-muted)',
                border: `1px solid ${showEMA ? 'rgba(255,184,0,0.3)' : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              EMA
            </button>

            {/* Timeframe */}
            <div className="tf-buttons">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  className={`tf-btn ${interval === tf.value ? 'active' : ''}`}
                  onClick={() => setInterval(tf.value)}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>

          <div className="chart-body">
            <CandlestickChart
              symbol={symbol}
              interval={interval}
              showEMA={showEMA}
              chartType={chartType}
            />
          </div>
        </div>

        <IndicatorsPanel symbol={symbol} interval={interval} />
      </div>
    </div>
  )
}
