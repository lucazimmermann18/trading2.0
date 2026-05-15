import { useEffect, useState } from 'react'
import { fetchQuote } from '../api/twelvedata'
import type { Quote } from '../types'

interface Props {
  symbols: string[]
  onSymbolSelect: (sym: string) => void
}

type SortKey = 'symbol' | 'price' | 'changePercent' | 'volume'

function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B'
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(0)
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const bars = Array.from({ length: 12 }, (_, i) => {
    const trend = positive ? i / 11 : 1 - i / 11
    const noise = (Math.random() - 0.5) * 0.3
    return Math.max(0.1, Math.min(1, trend + noise))
  })

  return (
    <div className="mini-sparkline">
      {bars.map((h, i) => (
        <div
          key={i}
          className="mini-bar"
          style={{
            height: `${h * 100}%`,
            background: positive ? 'rgba(0,255,136,0.6)' : 'rgba(255,61,90,0.6)',
          }}
        />
      ))}
    </div>
  )
}

export default function WatchlistPage({ symbols, onSymbolSelect }: Props) {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('symbol')
  const [sortDir, setSortDir] = useState<1 | -1>(1)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const q = await fetchQuote(symbols)
        setQuotes(q)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [symbols])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(1) }
  }

  const sorted = [...quotes]
    .filter((q) => q.symbol.toLowerCase().includes(filter.toLowerCase()) || (q.name || '').toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      let va: number | string = a[sortKey] ?? a.symbol
      let vb: number | string = b[sortKey] ?? b.symbol
      if (typeof va === 'string') return va.localeCompare(vb as string) * sortDir
      return ((va as number) - (vb as number)) * sortDir
    })

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      <span style={{ marginLeft: 4, color: 'var(--cyan)' }}>{sortDir === 1 ? '↑' : '↓'}</span>
    ) : (
      <span style={{ marginLeft: 4, opacity: 0.3 }}>↕</span>
    )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Watchlist ({quotes.length})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="header-search" style={{ width: 180 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              placeholder="Filter symbols..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-row">
            <div className="spinner" />
            Loading market data...
          </div>
        ) : (
          <table className="watchlist-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20, cursor: 'pointer' }} onClick={() => handleSort('symbol')}>
                  Symbol <SortIcon col="symbol" />
                </th>
                <th className="right" style={{ cursor: 'pointer' }} onClick={() => handleSort('price')}>
                  Price <SortIcon col="price" />
                </th>
                <th className="right" style={{ cursor: 'pointer' }} onClick={() => handleSort('changePercent')}>
                  Change <SortIcon col="changePercent" />
                </th>
                <th className="right">24h Range</th>
                <th className="right" style={{ cursor: 'pointer' }} onClick={() => handleSort('volume')}>
                  Volume <SortIcon col="volume" />
                </th>
                <th className="right" style={{ paddingRight: 20 }}>Trend</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((q) => (
                <tr key={q.symbol} onClick={() => onSymbolSelect(q.symbol)}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="wl-sym">{q.symbol}</div>
                    <div className="wl-name">{q.name || q.exchange}</div>
                  </td>
                  <td className="right">
                    <span className="wl-price">
                      ${q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: q.price >= 100 ? 2 : 4 })}
                    </span>
                  </td>
                  <td className="right">
                    <div className={`wl-chg ${q.changePercent >= 0 ? 'up' : 'down'}`}>
                      {q.changePercent >= 0 ? '+' : ''}{q.changePercent.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {q.change >= 0 ? '+' : ''}{q.change.toFixed(2)}
                    </div>
                  </td>
                  <td className="right">
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {q.low.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — {q.high.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ marginTop: 4, height: 3, background: 'var(--border)', borderRadius: 2, position: 'relative', width: 80, marginLeft: 'auto' }}>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${Math.min(100, Math.max(0, ((q.price - q.low) / (q.high - q.low || 1)) * 100))}%`,
                          top: -2,
                          width: 7,
                          height: 7,
                          background: 'var(--cyan)',
                          borderRadius: '50%',
                          transform: 'translateX(-50%)',
                        }}
                      />
                    </div>
                  </td>
                  <td className="right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatVolume(q.volume)}
                  </td>
                  <td className="right" style={{ paddingRight: 20 }}>
                    <MiniSparkline positive={q.changePercent >= 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
