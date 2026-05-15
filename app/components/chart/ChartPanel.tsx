"use client"
import { useEffect, useRef, useState } from "react"
import type { Pair, Timeframe, OHLCBar } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { fetchBars } from "@/app/lib/twelvedata"

const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "H1", "H4", "D1"]

interface Props {
  pair: Pair
  timeframe: Timeframe
  setTimeframe: (tf: Timeframe) => void
}

/* ── Indicator calculations ──────────────────────────────── */
function calcEMA(values: number[], period: number): number[] {
  if (!values.length) return []
  const k = 2 / (period + 1)
  const out = [values[0]]
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k))
  }
  return out
}

function calcRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return new Array(closes.length).fill(50)
  const rsi: number[] = new Array(period).fill(50)
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) avgGain += diff; else avgLoss += -diff
  }
  avgGain /= period
  avgLoss /= period
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
  }
  return rsi
}

function calcMACD(closes: number[]) {
  if (closes.length < 26) return { macd: [] as number[], signal: [] as number[], hist: [] as number[] }
  const fast = calcEMA(closes, 12)
  const slow = calcEMA(closes, 26)
  const macd = fast.map((v, i) => v - slow[i])
  const signalLine = calcEMA(macd.slice(25), 9)
  const hist = macd.slice(25).map((v, i) => v - (signalLine[i] ?? 0))
  const pad25 = new Array(25).fill(0)
  return {
    macd:   [...pad25, ...macd.slice(25)],
    signal: [...pad25, ...signalLine],
    hist:   [...pad25, ...hist],
  }
}

function calcBB(closes: number[], period = 20, mult = 2) {
  const upper: number[] = [], mid: number[] = [], lower: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(NaN); mid.push(NaN); lower.push(NaN); continue }
    const slice = closes.slice(i - period + 1, i + 1)
    const sma = slice.reduce((s, v) => s + v, 0) / period
    const variance = slice.reduce((s, v) => s + (v - sma) ** 2, 0) / period
    const std = Math.sqrt(variance)
    upper.push(sma + mult * std)
    mid.push(sma)
    lower.push(sma - mult * std)
  }
  return { upper, mid, lower }
}

/* ── RSI mini-chart (SVG) ────────────────────────────────── */
function RSIChart({ bars }: { bars: OHLCBar[] }) {
  const closes = bars.map(b => b.close)
  const rsi = calcRSI(closes)
  const W = 1000, H = 80, pad = 4
  const toY = (v: number) => pad + (1 - (v - 0) / 100) * (H - pad * 2)
  const path = rsi.map((v, i) => {
    const x = pad + (i / (rsi.length - 1)) * (W - pad * 2)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${toY(v).toFixed(1)}`
  }).join(" ")
  const lastRSI = rsi[rsi.length - 1]
  const col = lastRSI >= 70 ? "#ff3d5a" : lastRSI <= 30 ? "#00ff88" : "#a78bfa"

  return (
    <div className="border-t border-white/[0.05] bg-ink-950/60 shrink-0" style={{ height: 88 }}>
      <div className="flex items-center justify-between px-4 pt-1.5 pb-0.5">
        <div className="text-[9px] tracking-[0.18em] uppercase text-mute">RSI (14)</div>
        <div className="num text-[10px] font-semibold" style={{ color: col }}>{lastRSI.toFixed(1)}</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 64 }} preserveAspectRatio="none">
        {/* OB/OS zones */}
        <rect x={0} y={pad} width={W} height={toY(70) - pad} fill="rgba(255,61,90,0.04)" />
        <rect x={0} y={toY(30)} width={W} height={H - toY(30) - pad} fill="rgba(0,255,136,0.04)" />
        {/* OB/OS lines */}
        <line x1={0} x2={W} y1={toY(70)} y2={toY(70)} stroke="rgba(255,61,90,0.3)" strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={0} x2={W} y1={toY(50)} y2={toY(50)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <line x1={0} x2={W} y1={toY(30)} y2={toY(30)} stroke="rgba(0,255,136,0.3)"  strokeWidth="0.5" strokeDasharray="3 3" />
        {/* RSI line */}
        <path d={path} stroke={col} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* OB/OS labels */}
        <text x={W - 4} y={toY(70) - 2} textAnchor="end" fill="rgba(255,61,90,0.5)" fontSize="8" fontFamily="JetBrains Mono">70</text>
        <text x={W - 4} y={toY(30) - 2} textAnchor="end" fill="rgba(0,255,136,0.5)" fontSize="8" fontFamily="JetBrains Mono">30</text>
      </svg>
    </div>
  )
}

/* ── MACD mini-chart (SVG) ───────────────────────────────── */
function MACDChart({ bars }: { bars: OHLCBar[] }) {
  const closes = bars.map(b => b.close)
  const { macd, signal, hist } = calcMACD(closes)
  const W = 1000, H = 80, pad = 4
  const allVals = [...macd, ...signal, ...hist].filter(v => !isNaN(v) && v !== 0)
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const range = maxV - minV || 1
  const toY = (v: number) => pad + (1 - (v - minV) / range) * (H - pad * 2)
  const zeroY = toY(0)

  const macdPath = macd.slice(25).map((v, i) => {
    const x = pad + ((i + 25) / (macd.length - 1)) * (W - pad * 2)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${toY(v).toFixed(1)}`
  }).join(" ")
  const sigPath = signal.slice(25).map((v, i) => {
    const x = pad + ((i + 25) / (macd.length - 1)) * (W - pad * 2)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${toY(v).toFixed(1)}`
  }).join(" ")

  const lastMACD = macd[macd.length - 1] ?? 0
  const lastSig  = signal[signal.length - 1] ?? 0
  const barW = (W - pad * 2) / Math.max(hist.length, 1)

  return (
    <div className="border-t border-white/[0.05] bg-ink-950/60 shrink-0" style={{ height: 88 }}>
      <div className="flex items-center justify-between px-4 pt-1.5 pb-0.5">
        <div className="text-[9px] tracking-[0.18em] uppercase text-mute">MACD (12,26,9)</div>
        <div className="flex items-center gap-3 num text-[10px]">
          <span style={{ color: "#00d4ff" }}>M {lastMACD > 0 ? "+" : ""}{lastMACD.toFixed(5)}</span>
          <span style={{ color: "#ff8800" }}>S {lastSig > 0 ? "+" : ""}{lastSig.toFixed(5)}</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 64 }} preserveAspectRatio="none">
        {/* Zero line */}
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        {/* Histogram bars */}
        {hist.slice(25).map((v, i) => {
          const x = pad + ((i + 25) / (hist.length - 1)) * (W - pad * 2)
          const top = Math.min(toY(v), zeroY)
          const h   = Math.abs(toY(v) - zeroY)
          const col = v >= 0 ? "rgba(0,255,136,0.4)" : "rgba(255,61,90,0.4)"
          return <rect key={i} x={x - barW * 0.3} y={top} width={barW * 0.6} height={Math.max(1, h)} fill={col} />
        })}
        {/* MACD line */}
        {macdPath && <path d={macdPath} stroke="#00d4ff" strokeWidth="1" fill="none" strokeLinecap="round" />}
        {/* Signal line */}
        {sigPath && <path d={sigPath} stroke="#ff8800" strokeWidth="1" fill="none" strokeLinecap="round" />}
      </svg>
    </div>
  )
}

/* ── Main ChartPanel ─────────────────────────────────────── */
export default function ChartPanel({ pair, timeframe, setTimeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef    = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeRef  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbUpperRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbMidRef   = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bbLowerRef = useRef<any>(null)

  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<"candle" | "line">("candle")
  const [indicators, setIndicators] = useState({ bb: false, rsi: false, macd: false })
  const [bars, setBars] = useState<OHLCBar[]>([])

  const trade = pair.status === "TRADE"
  const pxColor = pair.history.length >= 2
    ? pair.history[pair.history.length - 1].close >= pair.history[pair.history.length - 2].close
      ? "#00ff88" : "#ff3d5a"
    : "#00d4ff"

  const toggleIndicator = (key: keyof typeof indicators) =>
    setIndicators(s => ({ ...s, [key]: !s[key] }))

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any, candle: any, line: any, vol: any, bbU: any, bbM: any, bbL: any, ro: ResizeObserver

    import("lightweight-charts").then(lc => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } = lc as any

      chart = createChart(containerRef.current!, {
        layout: { background: { type: ColorType.Solid, color: "#070a12" }, textColor: "#5a6779" },
        grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(255,255,255,0.15)", style: 3 },
          horzLine: { color: "rgba(255,255,255,0.15)", style: 3 },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", scaleMargins: { top: 0.06, bottom: 0.22 } },
        timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
        handleScroll: true, handleScale: true,
      })
      chartRef.current = chart

      candle = chart.addSeries(CandlestickSeries, {
        upColor: "#00ff88", downColor: "#ff3d5a",
        borderUpColor: "#00ff88", borderDownColor: "#ff3d5a",
        wickUpColor: "#00ff88", wickDownColor: "#ff3d5a",
      })
      candleRef.current = candle

      line = chart.addSeries(LineSeries, {
        color: "#00d4ff", lineWidth: 2,
        crosshairMarkerRadius: 5,
        crosshairMarkerBorderColor: "#00d4ff",
        crosshairMarkerBackgroundColor: "#0a0e1a",
        visible: false,
      })
      lineRef.current = line

      vol = chart.addSeries(HistogramSeries, {
        color: "#1d2531",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      })
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      volumeRef.current = vol

      // Bollinger Bands (overlay on main scale, hidden by default)
      bbU = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.35)", lineWidth: 1, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbM = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.20)", lineWidth: 1, lineStyle: 2, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbL = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.35)", lineWidth: 1, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbUpperRef.current = bbU
      bbMidRef.current   = bbM
      bbLowerRef.current = bbL

      ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
        }
      })
      if (containerRef.current) ro.observe(containerRef.current)
    })

    return () => {
      ro?.disconnect()
      chartRef.current?.remove()
      chartRef.current = null
      candleRef.current = null
      lineRef.current = null
      volumeRef.current = null
      bbUpperRef.current = null
      bbMidRef.current = null
      bbLowerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load data when pair or timeframe changes
  useEffect(() => {
    if (!candleRef.current) return
    setLoading(true)
    const load = async () => {
      let loadedBars: OHLCBar[]
      try {
        const fetched = await fetchBars(pair.sym, timeframe, 150)
        loadedBars = fetched.length ? fetched : pair.history
      } catch {
        loadedBars = pair.history
      }
      setBars(loadedBars)

      const cd = loadedBars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
      const ld = loadedBars.map(b => ({ time: b.time, value: b.close }))
      const vd = loadedBars.map(b => ({
        time: b.time, value: b.volume ?? 0,
        color: b.close >= b.open ? "rgba(0,255,136,0.22)" : "rgba(255,61,90,0.22)",
      }))
      candleRef.current?.setData(cd)
      lineRef.current?.setData(ld)
      volumeRef.current?.setData(vd)

      // Bollinger Bands data
      const closes = loadedBars.map(b => b.close)
      const { upper, mid, lower } = calcBB(closes)
      const bbData = (vals: number[]) =>
        loadedBars.map((b, i) => ({ time: b.time, value: vals[i] })).filter(d => !isNaN(d.value))
      bbUpperRef.current?.setData(bbData(upper))
      bbMidRef.current?.setData(bbData(mid))
      bbLowerRef.current?.setData(bbData(lower))

      chartRef.current?.timeScale().fitContent()
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.id, timeframe, !!candleRef.current])

  // Update latest bar on price tick
  useEffect(() => {
    const last = pair.history[pair.history.length - 1]
    if (!last || loading || !candleRef.current) return
    candleRef.current?.update({ time: last.time, open: last.open, high: last.high, low: last.low, close: last.close })
    lineRef.current?.update({ time: last.time, value: last.close })
    setBars(prev => {
      if (!prev.length) return prev
      const updated = [...prev.slice(0, -1), { ...prev[prev.length - 1], close: last.close }]
      return updated
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.px])

  // Toggle chart type
  useEffect(() => {
    if (!candleRef.current || !lineRef.current) return
    candleRef.current.applyOptions({ visible: chartType === "candle" })
    lineRef.current.applyOptions({ visible: chartType === "line" })
  }, [chartType])

  // Toggle BB visibility
  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: indicators.bb })
    bbMidRef.current?.applyOptions({ visible: indicators.bb })
    bbLowerRef.current?.applyOptions({ visible: indicators.bb })
  }, [indicators.bb])

  const INDS: { key: keyof typeof indicators; label: string; color: string }[] = [
    { key: "bb",   label: "BB",   color: "#00d4ff" },
    { key: "rsi",  label: "RSI",  color: "#a78bfa" },
    { key: "macd", label: "MACD", color: "#ffb800" },
  ]

  return (
    <div className={`flex-1 flex flex-col panel border-t-0 border-b-0 m-2 rounded-xl overflow-hidden relative ${trade ? "animate-glowBorder" : ""}`}>
      {/* Toolbar */}
      <div className="h-12 flex items-center px-4 border-b hairline gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="text-[15px] font-semibold text-white tracking-tight">{pair.sym}</div>
          <div className="text-[10px] text-mute tracking-[0.14em] uppercase hidden xl:block">{pair.name}</div>
        </div>

        <div className="num text-[16px] font-semibold" style={{ color: pxColor }}>
          {fmt(pair.px, pair.digits)}
        </div>

        {trade && pair.signal && (
          <div className={`flex items-center gap-1.5 px-2.5 h-6 rounded-[5px] text-[10px] font-bold tracking-[0.18em]
            ${pair.signal.side === "BUY" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"}`}>
            ⚡ {pair.signal.side} · {pair.signal.confidence}%
          </div>
        )}

        <div className="flex-1" />

        {/* Indicator toggles */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          {INDS.map(ind => (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium num transition
                ${indicators[ind.key]
                  ? "bg-white/[0.08] text-white"
                  : "text-mute hover:text-white"}`}
              style={indicators[ind.key] ? { color: ind.color } : {}}
            >
              {ind.label}
            </button>
          ))}
        </div>

        {/* Chart type */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          <button onClick={() => setChartType("candle")}
            className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium transition ${chartType === "candle" ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
            Candles
          </button>
          <button onClick={() => setChartType("line")}
            className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium transition ${chartType === "line" ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
            Line
          </button>
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium num transition
                ${timeframe === tf ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart area + sub-charts */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Main chart */}
        <div className="flex-1 relative min-h-0">
          <div ref={containerRef} className="w-full h-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/80">
              <div className="w-8 h-8 border-2 border-white/10 border-t-accent-blue rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* RSI sub-chart */}
        {indicators.rsi && bars.length > 14 && <RSIChart bars={bars} />}

        {/* MACD sub-chart */}
        {indicators.macd && bars.length > 26 && <MACDChart bars={bars} />}
      </div>

      {/* Signal levels overlay */}
      {trade && pair.signal && (
        <div className="absolute right-16 top-16 flex flex-col gap-1.5 text-[10px] num pointer-events-none z-10">
          <div className="px-2 py-1 rounded bg-accent-blue/20 text-accent-blue border border-accent-blue/30">E {fmt(pair.signal.entry, pair.digits)}</div>
          <div className="px-2 py-1 rounded bg-accent-green/15 text-accent-green border border-accent-green/25">TP1 {fmt(pair.signal.tp1, pair.digits)}</div>
          <div className="px-2 py-1 rounded bg-accent-green/15 text-accent-green border border-accent-green/25">TP2 {fmt(pair.signal.tp2, pair.digits)}</div>
          <div className="px-2 py-1 rounded bg-accent-red/15 text-accent-red border border-accent-red/25">SL {fmt(pair.signal.sl, pair.digits)}</div>
        </div>
      )}
    </div>
  )
}
