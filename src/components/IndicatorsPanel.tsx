import { useEffect, useState } from 'react'
import { fetchRSI, fetchMACD } from '../api/twelvedata'
import type { TimeFrame } from '../types'

interface Props {
  symbol: string
  interval: TimeFrame
}

function getRsiColor(v: number): string {
  if (v >= 70) return 'var(--red)'
  if (v <= 30) return 'var(--green)'
  return 'var(--cyan)'
}

function getRsiSignal(v: number): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (v <= 30) return 'BUY'
  if (v >= 70) return 'SELL'
  return 'NEUTRAL'
}

function getMacdSignal(macd: number, signal: number): 'BUY' | 'SELL' | 'NEUTRAL' {
  if (macd > signal) return 'BUY'
  if (macd < signal) return 'SELL'
  return 'NEUTRAL'
}

export default function IndicatorsPanel({ symbol, interval }: Props) {
  const [rsiValue, setRsiValue] = useState<number | null>(null)
  const [macdData, setMacdData] = useState<{ macd: number; signal: number; histogram: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [rsiArr, macdArr] = await Promise.all([
          fetchRSI(symbol, interval),
          fetchMACD(symbol, interval),
        ])
        if (rsiArr.length > 0) setRsiValue(rsiArr[rsiArr.length - 1].value)
        if (macdArr.length > 0) setMacdData(macdArr[macdArr.length - 1])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [symbol, interval])

  const rsiSignal = rsiValue != null ? getRsiSignal(rsiValue) : null
  const macdSignal = macdData ? getMacdSignal(macdData.macd, macdData.signal) : null

  if (loading) {
    return (
      <div className="indicators-panel">
        {[1, 2].map((i) => (
          <div className="indicator-card" key={i}>
            <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 14 }} />
            <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 8 }} />
            <div className="skeleton" style={{ width: 60, height: 12 }} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="indicators-panel">
      {/* RSI Card */}
      <div className="indicator-card">
        <div className="indicator-title">RSI (14)</div>
        {rsiValue != null ? (
          <>
            <div className={`rsi-value-big`} style={{ color: getRsiColor(rsiValue) }}>
              {rsiValue.toFixed(1)}
            </div>
            <div className="rsi-gauge">
              <div className="rsi-bar-track">
                <div
                  className="rsi-bar-fill"
                  style={{
                    width: `${rsiValue}%`,
                    background: `linear-gradient(90deg, var(--green) 0%, ${rsiValue > 50 ? 'var(--amber)' : 'var(--green)'} 50%, ${rsiValue >= 70 ? 'var(--red)' : 'var(--cyan)'} 100%)`,
                  }}
                />
              </div>
              <div className="rsi-zones">
                <span style={{ color: 'var(--green)' }}>30</span>
                <span>50</span>
                <span style={{ color: 'var(--red)' }}>70</span>
              </div>
            </div>
            <div className="indicator-row" style={{ marginTop: 8 }}>
              <span className="indicator-name">Signal</span>
              <span className={`indicator-signal ${rsiSignal?.toLowerCase()}`}>{rsiSignal}</span>
            </div>
            <div className="indicator-row">
              <span className="indicator-name">
                {rsiValue >= 70 ? 'Overbought territory' : rsiValue <= 30 ? 'Oversold territory' : 'Neutral zone'}
              </span>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
        )}
      </div>

      {/* MACD Card */}
      <div className="indicator-card">
        <div className="indicator-title">MACD (12,26,9)</div>
        {macdData ? (
          <>
            <div className="indicator-row">
              <span className="indicator-name">MACD Line</span>
              <span className="indicator-value" style={{ color: macdData.macd >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {macdData.macd.toFixed(4)}
              </span>
            </div>
            <div className="indicator-row">
              <span className="indicator-name">Signal Line</span>
              <span className="indicator-value" style={{ color: 'var(--cyan)' }}>
                {macdData.signal.toFixed(4)}
              </span>
            </div>
            <div className="indicator-row">
              <span className="indicator-name">Histogram</span>
              <span className="indicator-value" style={{ color: macdData.histogram >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {macdData.histogram.toFixed(4)}
              </span>
            </div>
            <div className="indicator-row" style={{ marginTop: 4 }}>
              <span className="indicator-name">Signal</span>
              <span className={`indicator-signal ${macdSignal?.toLowerCase()}`}>{macdSignal}</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 48 }}>
                {[-3, -2, -1, 0, 1, 2, 3, 4, 2, 1, macdData.histogram].map((v, i) => {
                  const abs = Math.abs(v)
                  const maxAbs = 4
                  const h = Math.max(4, (abs / maxAbs) * 44)
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: `${h}px`,
                        background: v >= 0 ? 'rgba(0,255,136,0.5)' : 'rgba(255,61,90,0.5)',
                        borderRadius: 2,
                        alignSelf: 'flex-end',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No data</div>
        )}
      </div>

      {/* Legend */}
      <div className="indicator-card">
        <div className="indicator-title">EMA Legend</div>
        <div className="indicator-row">
          <span className="indicator-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: '#ffb800', display: 'inline-block', borderRadius: 1 }} />
            EMA 20
          </span>
          <span className="indicator-value" style={{ color: '#ffb800', fontSize: 11 }}>Short-term</span>
        </div>
        <div className="indicator-row">
          <span className="indicator-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 16, height: 2, background: '#a78bfa', display: 'inline-block', borderRadius: 1 }} />
            EMA 50
          </span>
          <span className="indicator-value" style={{ color: '#a78bfa', fontSize: 11 }}>Mid-term</span>
        </div>
        <div className="indicator-row">
          <span className="indicator-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--green)', display: 'inline-block', borderRadius: 2 }} />
            Bullish candle
          </span>
        </div>
        <div className="indicator-row">
          <span className="indicator-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: 'var(--red)', display: 'inline-block', borderRadius: 2 }} />
            Bearish candle
          </span>
        </div>
      </div>
    </div>
  )
}
