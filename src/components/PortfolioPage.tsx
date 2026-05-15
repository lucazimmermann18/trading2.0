import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { fetchQuote } from '../api/twelvedata'
import type { Quote } from '../types'

interface Props {
  onSymbolSelect: (sym: string) => void
}

interface Position {
  symbol: string
  shares: number
  avgCost: number
  type: 'stock' | 'crypto' | 'etf'
}

const DEMO_POSITIONS: Position[] = [
  { symbol: 'AAPL', shares: 50, avgCost: 175.50, type: 'stock' },
  { symbol: 'NVDA', shares: 20, avgCost: 480.00, type: 'stock' },
  { symbol: 'MSFT', shares: 15, avgCost: 370.00, type: 'stock' },
  { symbol: 'TSLA', shares: 30, avgCost: 220.00, type: 'stock' },
  { symbol: 'BTC/USD', shares: 0.5, avgCost: 42000, type: 'crypto' },
  { symbol: 'ETH/USD', shares: 5, avgCost: 2800, type: 'crypto' },
  { symbol: 'SPY', shares: 25, avgCost: 470.00, type: 'etf' },
]

const COLORS = ['#00d4ff', '#00ff88', '#a78bfa', '#ffb800', '#ff3d5a', '#00b4d8', '#7c3aed']

function formatCurrency(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function PortfolioPage({ onSymbolSelect }: Props) {
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const syms = DEMO_POSITIONS.map((p) => p.symbol)
        const qs = await fetchQuote(syms)
        const map = new Map(qs.map((q) => [q.symbol, q]))
        setQuotes(map)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const enriched = DEMO_POSITIONS.map((pos) => {
    const q = quotes.get(pos.symbol)
    const currentPrice = q?.price ?? pos.avgCost
    const currentValue = currentPrice * pos.shares
    const costBasis = pos.avgCost * pos.shares
    const pnl = currentValue - costBasis
    const pnlPct = (pnl / costBasis) * 100
    return { ...pos, currentPrice, currentValue, costBasis, pnl, pnlPct, quote: q }
  })

  const totalValue = enriched.reduce((s, p) => s + p.currentValue, 0)
  const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = (totalPnl / totalCost) * 100

  const pieData = enriched.map((p, i) => ({
    name: p.symbol.replace('/USD', ''),
    value: (p.currentValue / totalValue) * 100,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div>
      {/* Summary stats */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-label">Portfolio Value</div>
          <div className="stat-value cyan">{formatCurrency(totalValue)}</div>
          <div className="stat-sub">Total current value</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Total Cost Basis</div>
          <div className="stat-value">{formatCurrency(totalCost)}</div>
          <div className="stat-sub">Original investment</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Unrealized P&L</div>
          <div className={`stat-value ${totalPnl >= 0 ? 'up' : 'down'}`}>{formatCurrency(totalPnl)}</div>
          <div className="stat-sub">{totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(2)}% return</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Positions</div>
          <div className="stat-value cyan">{DEMO_POSITIONS.length}</div>
          <div className="stat-sub">Across {new Set(DEMO_POSITIONS.map((p) => p.type)).size} asset classes</div>
        </div>
      </div>

      <div className="portfolio-section">
        {/* Positions table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>
            Positions
          </div>
          <div style={{ padding: '0 20px' }}>
            {loading ? (
              <div className="loading-row"><div className="spinner" /> Loading positions...</div>
            ) : (
              enriched.map((pos) => (
                <div key={pos.symbol} className="position-row" onClick={() => onSymbolSelect(pos.symbol)}>
                  <div className="pos-info">
                    <div className="pos-sym">{pos.symbol.replace('/USD', '')}</div>
                    <div className="pos-shares">
                      {pos.shares} {pos.type === 'crypto' ? 'coins' : 'shares'} @ {formatCurrency(pos.avgCost)}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontWeight: 600,
                        background: pos.type === 'crypto' ? 'var(--purple-dim)' : pos.type === 'etf' ? 'var(--amber-dim)' : 'var(--cyan-dim)',
                        color: pos.type === 'crypto' ? 'var(--purple)' : pos.type === 'etf' ? 'var(--amber)' : 'var(--cyan)',
                      }}>
                        {pos.type.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div style={{ flex: 1, marginLeft: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current:</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                        {formatCurrency(pos.currentPrice)}
                      </span>
                      <span style={{ fontSize: 11, color: pos.quote?.changePercent && pos.quote.changePercent >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-mono)' }}>
                        {pos.quote?.changePercent ? `${pos.quote.changePercent >= 0 ? '+' : ''}${pos.quote.changePercent.toFixed(2)}%` : ''}
                      </span>
                    </div>
                    <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', width: '100%', maxWidth: 200 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, Math.abs((pos.currentValue / totalValue) * 100 * 3))}%`,
                          background: 'var(--cyan)',
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {((pos.currentValue / totalValue) * 100).toFixed(1)}% of portfolio
                    </div>
                  </div>

                  <div className="pos-values">
                    <div className="pos-value">{formatCurrency(pos.currentValue)}</div>
                    <div className={`pos-pnl ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{formatCurrency(pos.pnl)}
                      <span style={{ marginLeft: 4 }}>({pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Allocation chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Allocation</div>
            <div className="donut-wrapper">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Allocation']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pieData.map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {d.value.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Asset class breakdown */}
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>By Asset Class</div>
            {(['stock', 'crypto', 'etf'] as const).map((cls) => {
              const positions = enriched.filter((p) => p.type === cls)
              const value = positions.reduce((s, p) => s + p.currentValue, 0)
              const pct = (value / totalValue) * 100
              return (
                <div key={cls} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>{cls}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: cls === 'stock' ? 'var(--cyan)' : cls === 'crypto' ? 'var(--purple)' : 'var(--amber)',
                      borderRadius: 2,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
