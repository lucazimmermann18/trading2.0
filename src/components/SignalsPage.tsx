import { useEffect, useState } from 'react'
import { fetchQuote, fetchRSI, fetchMACD } from '../api/twelvedata'
import type { Quote, Signal } from '../types'

interface Props {
  symbols: string[]
  onSymbolSelect: (sym: string) => void
}

function computeSignal(quote: Quote, rsi: number | null, macdHist: number | null): Signal {
  let type: Signal['type'] = 'HOLD'
  let confidence = 50
  let indicator = 'Price Action'

  const signals: string[] = []

  if (rsi !== null) {
    if (rsi <= 30) { signals.push('RSI Oversold'); confidence += 20; type = 'BUY'; indicator = 'RSI' }
    else if (rsi >= 70) { signals.push('RSI Overbought'); confidence += 20; type = 'SELL'; indicator = 'RSI' }
  }

  if (macdHist !== null) {
    if (macdHist > 0) { signals.push('MACD Bullish'); confidence += 15; if (type !== 'SELL') type = 'BUY' }
    else if (macdHist < 0) { signals.push('MACD Bearish'); confidence += 15; if (type !== 'BUY') type = 'SELL' }
  }

  if (quote.changePercent > 2) { signals.push('Strong Momentum'); if (type === 'HOLD') type = 'BUY'; confidence += 10 }
  else if (quote.changePercent < -2) { signals.push('Bearish Pressure'); if (type === 'HOLD') type = 'SELL'; confidence += 10 }

  confidence = Math.min(confidence, 95)

  const targetMultiplier = type === 'BUY' ? 1 + Math.random() * 0.05 + 0.02 : 1 - Math.random() * 0.05 - 0.02
  const stopMultiplier = type === 'BUY' ? 1 - Math.random() * 0.03 - 0.01 : 1 + Math.random() * 0.03 + 0.01

  return {
    id: `${quote.symbol}-${Date.now()}`,
    symbol: quote.symbol,
    type,
    price: quote.price,
    targetPrice: quote.price * targetMultiplier,
    stopLoss: quote.price * stopMultiplier,
    confidence,
    indicator: signals.length > 0 ? signals.join(' + ') : 'Consolidation',
    timestamp: Date.now(),
    timeframe: '1D',
  }
}

export default function SignalsPage({ symbols, onSymbolSelect }: Props) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const quotes = await fetchQuote(symbols)
        const withIndicators = await Promise.all(
          quotes.map(async (q) => {
            try {
              const [rsiArr, macdArr] = await Promise.all([
                fetchRSI(q.symbol, '1day'),
                fetchMACD(q.symbol, '1day'),
              ])
              const rsi = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1].value : null
              const macdHist = macdArr.length > 0 ? macdArr[macdArr.length - 1].histogram : null
              return computeSignal(q, rsi, macdHist)
            } catch {
              return computeSignal(q, null, null)
            }
          })
        )
        setSignals(withIndicators)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [symbols])

  const filtered = signals.filter((s) => filter === 'ALL' || s.type === filter)

  const buys = signals.filter((s) => s.type === 'BUY').length
  const sells = signals.filter((s) => s.type === 'SELL').length
  const holds = signals.filter((s) => s.type === 'HOLD').length

  return (
    <div>
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-label">Buy Signals</div>
          <div className="stat-value up">{buys}</div>
          <div className="stat-sub">Instruments with bullish signals</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Sell Signals</div>
          <div className="stat-value down">{sells}</div>
          <div className="stat-sub">Instruments with bearish signals</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Hold / Neutral</div>
          <div className="stat-value" style={{ color: 'var(--amber)' }}>{holds}</div>
          <div className="stat-sub">Instruments in consolidation</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Market Bias</div>
          <div className={`stat-value ${buys > sells ? 'up' : buys < sells ? 'down' : 'cyan'}`}>
            {buys > sells ? 'BULLISH' : buys < sells ? 'BEARISH' : 'NEUTRAL'}
          </div>
          <div className="stat-sub">Overall signal direction</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>AI Trading Signals</div>
        <div className="tabs">
          {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map((f) => (
            <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-row">
          <div className="spinner" />
          Analyzing market indicators...
        </div>
      ) : (
        <div className="signals-grid">
          {filtered.map((sig) => (
            <div
              key={sig.id}
              className={`signal-card ${sig.type.toLowerCase()}`}
              onClick={() => onSymbolSelect(sig.symbol)}
            >
              <div className="signal-header">
                <div>
                  <div className="signal-sym">{sig.symbol}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sig.timeframe} • {sig.indicator}</div>
                </div>
                <span className={`signal-type-badge ${sig.type.toLowerCase()}`}>{sig.type}</span>
              </div>

              <div className="signal-prices">
                <div className="signal-price-item entry">
                  <label>Entry</label>
                  <span>${sig.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="signal-price-item target">
                  <label>Target</label>
                  <span>${sig.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="signal-price-item stop">
                  <label>Stop Loss</label>
                  <span>${sig.stopLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="signal-footer">
                <div className="signal-confidence">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Confidence</span>
                  <div className="confidence-bar">
                    <div
                      className="confidence-fill"
                      style={{
                        width: `${sig.confidence}%`,
                        background: sig.confidence >= 75 ? 'var(--green)' : sig.confidence >= 55 ? 'var(--cyan)' : 'var(--amber)',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {sig.confidence}%
                  </span>
                </div>

                <div className="signal-meta">
                  <span>{new Date(sig.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>

              {/* R:R ratio */}
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Risk/Reward</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--cyan)' }}>
                  1:{(Math.abs(sig.targetPrice - sig.price) / Math.abs(sig.price - sig.stopLoss)).toFixed(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
