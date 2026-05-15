import { useEffect, useState } from 'react'
import { fetchQuote } from '../api/twelvedata'
import type { Quote } from '../types'

interface Props {
  symbols: string[]
  onSymbolSelect: (sym: string) => void
}

const HEATMAP_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'AMZN',
  'GOOGL', 'META', 'TSLA', 'SPY',
  'BTC/USD', 'ETH/USD', 'QQQ', 'AMD',
]

function formatPrice(p: number): string {
  if (p >= 10000) return p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}

function getHeatColor(pct: number): string {
  if (pct >= 3) return 'rgba(0,255,136,0.55)'
  if (pct >= 1) return 'rgba(0,255,136,0.30)'
  if (pct >= 0) return 'rgba(0,255,136,0.15)'
  if (pct >= -1) return 'rgba(255,61,90,0.15)'
  if (pct >= -3) return 'rgba(255,61,90,0.30)'
  return 'rgba(255,61,90,0.55)'
}

function PriceCardSkeleton() {
  return (
    <div className="price-card">
      <div className="price-card-header">
        <div>
          <div className="skeleton" style={{ width: 60, height: 16, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: 100, height: 12 }} />
        </div>
        <div className="skeleton" style={{ width: 40, height: 18, borderRadius: 4 }} />
      </div>
      <div className="skeleton" style={{ width: 120, height: 28, marginBottom: 6 }} />
      <div className="skeleton" style={{ width: 80, height: 16 }} />
    </div>
  )
}

export default function Dashboard({ symbols, onSymbolSelect }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [heatQuotes, setHeatQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSym, setSelectedSym] = useState<string | null>(null)

  const MAIN_SYMBOLS = symbols.slice(0, 6)

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [main, heat] = await Promise.all([
          fetchQuote(MAIN_SYMBOLS),
          fetchQuote(HEATMAP_SYMBOLS),
        ])
        setQuotes(main)
        setHeatQuotes(heat)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load market data')
      } finally {
        setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  const gainers = [...quotes].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3)
  const losers = [...quotes].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3)

  const totalPositive = quotes.filter((q) => q.changePercent > 0).length
  const avgChange = quotes.length ? quotes.reduce((s, q) => s + q.changePercent, 0) / quotes.length : 0

  return (
    <div>
      {error && (
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Stat row */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-label">Market Pulse</div>
          <div className={`stat-value ${avgChange >= 0 ? 'up' : 'down'}`}>
            {avgChange >= 0 ? '+' : ''}{avgChange.toFixed(2)}%
          </div>
          <div className="stat-sub">Avg change across watchlist</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Advancing</div>
          <div className="stat-value cyan">{totalPositive}/{quotes.length}</div>
          <div className="stat-sub">Instruments in positive territory</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Top Gainer</div>
          <div className="stat-value up">
            {gainers[0] ? `+${gainers[0].changePercent.toFixed(2)}%` : '—'}
          </div>
          <div className="stat-sub">{gainers[0]?.symbol ?? 'Loading...'}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Top Loser</div>
          <div className="stat-value down">
            {losers[0] ? `${losers[0].changePercent.toFixed(2)}%` : '—'}
          </div>
          <div className="stat-sub">{losers[0]?.symbol ?? 'Loading...'}</div>
        </div>
      </div>

      {/* Price cards */}
      <div className="price-cards">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <PriceCardSkeleton key={i} />)
          : quotes.map((q) => (
            <div
              key={q.symbol}
              className={`price-card ${selectedSym === q.symbol ? 'selected' : ''}`}
              onClick={() => {
                setSelectedSym(q.symbol)
                onSymbolSelect(q.symbol)
              }}
            >
              <div className="price-card-header">
                <div>
                  <div className="price-card-sym">{q.symbol}</div>
                  <div className="price-card-name">{q.name || q.exchange}</div>
                </div>
                <span className={`price-card-badge ${q.type}`}>{q.type.toUpperCase()}</span>
              </div>
              <div className="price-card-price">${formatPrice(q.price)}</div>
              <div className={`price-card-change ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                <span>{q.changePercent >= 0 ? '▲' : '▼'}</span>
                {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
                  ({q.change >= 0 ? '+' : ''}{q.change.toFixed(2)})
                </span>
              </div>
              <div className="price-card-meta">
                <div className="price-card-meta-item">
                  <label>High</label>
                  <span>${formatPrice(q.high)}</span>
                </div>
                <div className="price-card-meta-item">
                  <label>Low</label>
                  <span>${formatPrice(q.low)}</span>
                </div>
                <div className="price-card-meta-item">
                  <label>Volume</label>
                  <span>{formatVolume(q.volume)}</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Heatmap + Movers */}
      <div className="bottom-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Market Heatmap</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Daily % Change</span>
          </div>
          {heatQuotes.length > 0 ? (
            <div className="market-heatmap">
              {heatQuotes.map((q) => (
                <div
                  key={q.symbol}
                  className="heatmap-cell"
                  style={{ background: getHeatColor(q.changePercent) }}
                  onClick={() => onSymbolSelect(q.symbol)}
                >
                  <span className="heatmap-sym">{q.symbol.replace('/USD', '')}</span>
                  <span className="heatmap-chg">
                    {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="loading-row">
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              Loading heatmap...
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Top Movers</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--green)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              ▲ Gainers
            </div>
            {gainers.map((q) => (
              <div
                key={q.symbol}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => onSymbolSelect(q.symbol)}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{q.symbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>${formatPrice(q.price)}</span>
                </div>
                <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                  +{q.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>

          <div>
            <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              ▼ Losers
            </div>
            {losers.map((q) => (
              <div
                key={q.symbol}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                onClick={() => onSymbolSelect(q.symbol)}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{q.symbol}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>${formatPrice(q.price)}</span>
                </div>
                <span style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                  {q.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
