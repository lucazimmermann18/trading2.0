"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Pair, Timeframe, OHLCBar } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { fetchBars } from "@/app/lib/twelvedata"
import { buildSMCContext, type SMCContext } from "@/app/lib/smc"

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
        <rect x={0} y={pad} width={W} height={toY(70) - pad} fill="rgba(255,61,90,0.04)" />
        <rect x={0} y={toY(30)} width={W} height={H - toY(30) - pad} fill="rgba(0,255,136,0.04)" />
        <line x1={0} x2={W} y1={toY(70)} y2={toY(70)} stroke="rgba(255,61,90,0.3)" strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={0} x2={W} y1={toY(50)} y2={toY(50)} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        <line x1={0} x2={W} y1={toY(30)} y2={toY(30)} stroke="rgba(0,255,136,0.3)"  strokeWidth="0.5" strokeDasharray="3 3" />
        <path d={path} stroke={col} strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
        <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        {hist.slice(25).map((v, i) => {
          const x = pad + ((i + 25) / (hist.length - 1)) * (W - pad * 2)
          const top = Math.min(toY(v), zeroY)
          const h   = Math.abs(toY(v) - zeroY)
          const col = v >= 0 ? "rgba(0,255,136,0.4)" : "rgba(255,61,90,0.4)"
          return <rect key={i} x={x - barW * 0.3} y={top} width={barW * 0.6} height={Math.max(1, h)} fill={col} />
        })}
        {macdPath && <path d={macdPath} stroke="#00d4ff" strokeWidth="1" fill="none" strokeLinecap="round" />}
        {sigPath && <path d={sigPath} stroke="#ff8800" strokeWidth="1" fill="none" strokeLinecap="round" />}
      </svg>
    </div>
  )
}

/* ── SVG helpers for SMC overlay ─────────────────────────── */
const NS = "http://www.w3.org/2000/svg"

function svgEl(tag: string, attrs: Record<string, string>) {
  const el = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/* ── Main ChartPanel ─────────────────────────────────────── */
export default function ChartPanel({ pair, timeframe, setTimeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
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
  const [smcVisible, setSmcVisible] = useState(true)
  const [bars, setBars] = useState<OHLCBar[]>([])
  const [smcCtx, setSmcCtx] = useState<SMCContext | null>(null)

  // Keep a ref to the redraw fn so the ResizeObserver (created once) can call it
  const redrawRef = useRef<() => void>(() => {})

  const trade = pair.status === "TRADE"
  const pxColor = pair.history.length >= 2
    ? pair.history[pair.history.length - 1].close >= pair.history[pair.history.length - 2].close
      ? "#00ff88" : "#ff3d5a"
    : "#00d4ff"

  const toggleIndicator = (key: keyof typeof indicators) =>
    setIndicators(s => ({ ...s, [key]: !s[key] }))

  // Compute SMC context whenever new H1 bars are loaded (not on every tick)
  useEffect(() => {
    if (pair.history.length >= 50) {
      setSmcCtx(buildSMCContext(pair.history, pair.px))
    } else {
      setSmcCtx(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.history.length])

  // Draw SMC overlay onto the SVG element
  const drawSMC = useCallback(() => {
    const svg = svgRef.current
    const series = candleRef.current
    const chart = chartRef.current
    const container = containerRef.current
    if (!svg || !series || !chart || !container || !smcCtx || !smcVisible) {
      if (svg) svg.innerHTML = ""
      return
    }

    const W = container.clientWidth
    const H = container.clientHeight
    svg.setAttribute("width",   String(W))
    svg.setAttribute("height",  String(H))
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
    svg.innerHTML = ""

    const ts = chart.timeScale()
    // Leave right margin for price scale (~68px)
    const chartW = W - 68

    // price → Y pixel; returns null if out of visible range
    const py = (price: number): number | null => {
      const c = series.priceToCoordinate(price)
      return (c == null || isNaN(c)) ? null : c
    }

    // Draw filled rectangle between two price levels
    const rect = (hiPrice: number, loPrice: number, fill: string, stroke: string, label: string) => {
      const y1 = py(hiPrice)
      const y2 = py(loPrice)
      if (y1 == null || y2 == null) return
      const top = Math.min(y1, y2)
      const h   = Math.max(Math.abs(y1 - y2), 2)

      svg.appendChild(svgEl("rect", {
        x: "0", y: String(top),
        width: String(chartW), height: String(h),
        fill, stroke, "stroke-width": "1",
      }))
      if (label && h > 10) {
        const txt = svgEl("text", {
          x: "5", y: String(top + Math.min(12, h - 2)),
          fill: stroke, "font-size": "9",
          "font-family": "JetBrains Mono, monospace",
          opacity: "0.85",
        })
        txt.textContent = label
        svg.appendChild(txt)
      }
    }

    // Draw horizontal dashed line at a price
    const hline = (price: number, color: string, dash: string, label: string) => {
      const y = py(price)
      if (y == null) return
      svg.appendChild(svgEl("line", {
        x1: "0", x2: String(chartW),
        y1: String(y), y2: String(y),
        stroke: color, "stroke-width": "1", "stroke-dasharray": dash,
      }))
      if (label) {
        const txt = svgEl("text", {
          x: String(chartW - 4), y: String(y - 3),
          "text-anchor": "end",
          fill: color, "font-size": "9",
          "font-family": "JetBrains Mono, monospace",
          opacity: "0.85",
        })
        txt.textContent = label
        svg.appendChild(txt)
      }
    }

    // ── Layer 1: FVGs (most transparent, below OBs) ──────────
    for (const fvg of smcCtx.fvgs) {
      const fill   = fvg.type === "bull" ? "rgba(0,212,255,0.06)" : "rgba(255,140,0,0.06)"
      const stroke = fvg.type === "bull" ? "rgba(0,212,255,0.3)"  : "rgba(255,140,0,0.3)"
      rect(fvg.top, fvg.bottom, fill, stroke, "FVG")
    }

    // ── Layer 2: Weekly / Daily key levels ───────────────────
    if (smcCtx.daily.weekHigh) hline(smcCtx.daily.weekHigh, "rgba(168,139,250,0.45)", "6 4", "W.High")
    if (smcCtx.daily.weekLow)  hline(smcCtx.daily.weekLow,  "rgba(168,139,250,0.45)", "6 4", "W.Low")
    if (smcCtx.daily.pdHigh)   hline(smcCtx.daily.pdHigh,   "rgba(251,191,36,0.6)",   "5 3", "PDH")
    if (smcCtx.daily.pdLow)    hline(smcCtx.daily.pdLow,    "rgba(251,191,36,0.6)",   "5 3", "PDL")

    // ── Layer 3: Liquidity levels (BSL / SSL) ────────────────
    for (const liq of smcCtx.liquidity) {
      const label = liq.type === "buyside" ? `BSL(${liq.touches})` : `SSL(${liq.touches})`
      hline(liq.price, "rgba(255,136,0,0.55)", "3 3", label)
    }

    // ── Layer 4: H4 Order Blocks (more opaque) ───────────────
    for (const ob of smcCtx.h4OrderBlocks) {
      if (ob.type === "bull") rect(ob.high, ob.low, "rgba(0,255,136,0.11)", "rgba(0,255,136,0.65)", "H4·OB")
      else                    rect(ob.high, ob.low, "rgba(255,61,90,0.11)", "rgba(255,61,90,0.65)",  "H4·OB")
    }

    // ── Layer 5: H1 Order Blocks ─────────────────────────────
    for (const ob of smcCtx.orderBlocks) {
      if (ob.type === "bull") rect(ob.high, ob.low, "rgba(0,255,136,0.06)", "rgba(0,255,136,0.4)", "OB")
      else                    rect(ob.high, ob.low, "rgba(255,61,90,0.06)", "rgba(255,61,90,0.4)",  "OB")
    }

    // ── Layer 6: Liquidity Sweep markers ─────────────────────
    for (const sweep of smcCtx.sweeps) {
      const barIdx = pair.history.length - 1 - sweep.barsAgo
      const bar = pair.history[barIdx]
      if (!bar) continue
      const xCoord = ts.timeToCoordinate(bar.time as number)
      if (xCoord == null || isNaN(xCoord) || xCoord < 0 || xCoord > chartW) continue

      const yPrice = sweep.type === "bull" ? bar.low : bar.high
      const y = py(yPrice)
      if (y == null) continue

      const col  = sweep.type === "bull" ? "rgba(0,255,136,0.9)" : "rgba(255,61,90,0.9)"
      const sz   = 5 + sweep.strength * 2
      const offset = sweep.type === "bull" ? 10 : -10
      const pts  = sweep.type === "bull"
        ? `${xCoord},${y + offset} ${xCoord - sz},${y + offset + sz} ${xCoord + sz},${y + offset + sz}`
        : `${xCoord},${y + offset} ${xCoord - sz},${y + offset - sz} ${xCoord + sz},${y + offset - sz}`

      svg.appendChild(svgEl("polygon", { points: pts, fill: col }))

      const lbl = svgEl("text", {
        x: String(xCoord + 8), y: String(y + (sweep.type === "bull" ? offset + sz + 10 : offset - sz - 2)),
        fill: col, "font-size": "8",
        "font-family": "JetBrains Mono, monospace",
        opacity: "0.9",
      })
      lbl.textContent = "⚡SWEEP"
      svg.appendChild(lbl)
    }
  }, [smcCtx, smcVisible, pair.history])

  // Keep ref in sync so ResizeObserver can call it
  useEffect(() => { redrawRef.current = drawSMC }, [drawSMC])

  // Subscribe to chart scroll/zoom events to redraw overlay
  useEffect(() => {
    if (!chartRef.current) return
    if (!smcCtx || !smcVisible) {
      if (svgRef.current) svgRef.current.innerHTML = ""
      return
    }
    chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(drawSMC)
    drawSMC()
    return () => {
      chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(drawSMC)
    }
  }, [smcCtx, smcVisible, drawSMC])

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

      bbU = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.35)", lineWidth: 1, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbM = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.20)", lineWidth: 1, lineStyle: 2, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbL = chart.addSeries(LineSeries, { color: "rgba(0,212,255,0.35)", lineWidth: 1, visible: false, priceLineVisible: false, lastValueVisible: false })
      bbUpperRef.current = bbU
      bbMidRef.current   = bbM
      bbLowerRef.current = bbL

      ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
          setTimeout(() => redrawRef.current(), 60)
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

      const closes = loadedBars.map(b => b.close)
      const { upper, mid, lower } = calcBB(closes)
      const bbData = (vals: number[]) =>
        loadedBars.map((b, i) => ({ time: b.time, value: vals[i] })).filter(d => !isNaN(d.value))
      bbUpperRef.current?.setData(bbData(upper))
      bbMidRef.current?.setData(bbData(mid))
      bbLowerRef.current?.setData(bbData(lower))

      chartRef.current?.timeScale().fitContent()
      setLoading(false)
      // Redraw SMC overlay after new bars are set
      setTimeout(() => redrawRef.current(), 100)
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
      return [...prev.slice(0, -1), { ...prev[prev.length - 1], close: last.close }]
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

        {/* SMC overlay toggle */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          <button
            onClick={() => setSmcVisible(s => !s)}
            title="Toggle SMC zones overlay (Order Blocks, FVGs, Sweeps, PDH/PDL)"
            className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium num transition
              ${smcVisible ? "bg-white/[0.08]" : "text-mute hover:text-white"}`}
            style={smcVisible ? { color: "#a78bfa" } : {}}
          >
            SMC
          </button>
        </div>

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
        {/* Main chart with SMC SVG overlay */}
        <div className="flex-1 relative min-h-0">
          <div ref={containerRef} className="w-full h-full" />
          {/* SMC overlay — drawn by drawSMC(), always present so subscriptions work */}
          <svg
            ref={svgRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 2 }}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-900/80" style={{ zIndex: 10 }}>
              <div className="w-8 h-8 border-2 border-white/10 border-t-accent-blue rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* RSI sub-chart */}
        {indicators.rsi && bars.length > 14 && <RSIChart bars={bars} />}

        {/* MACD sub-chart */}
        {indicators.macd && bars.length > 26 && <MACDChart bars={bars} />}
      </div>

      {/* Signal levels overlay (top-right corner) */}
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
