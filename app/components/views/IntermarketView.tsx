"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import type { OHLCBar, Timeframe } from "@/app/lib/types"
import { fetchBars } from "@/app/lib/twelvedata"

/* ── Constants ───────────────────────────────────────────── */
const TIMEFRAMES: Timeframe[] = ["M15", "H1", "H4", "D1"]

const CORR_ASSETS = [
  { sym: "EUR/USD", label: "EUR/USD", color: "#00d4ff",  expectedCorr: "inverse",  note: "Stärkste inverse Korrelation zum DXY" },
  { sym: "GBP/USD", label: "GBP/USD", color: "#a78bfa",  expectedCorr: "inverse",  note: "Folgt DXY ähnlich wie EUR/USD" },
  { sym: "XAU/USD", label: "Gold",    color: "#fbbf24",  expectedCorr: "inverse",  note: "Safe-Haven — kann von DXY entkoppeln" },
  { sym: "US100",   label: "Nasdaq",  color: "#00ff88",  expectedCorr: "positive", note: "Risk-On Indikator, oft positiv zu DXY" },
] as const

/* ── Maths ───────────────────────────────────────────────── */
function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 5) return 0
  const sa = a.slice(0, n), sb = b.slice(0, n)
  const ma = sa.reduce((s, v) => s + v, 0) / n
  const mb = sb.reduce((s, v) => s + v, 0) / n
  let num = 0, da2 = 0, db2 = 0
  for (let i = 0; i < n; i++) {
    const da = sa[i] - ma, db = sb[i] - mb
    num += da * db; da2 += da * da; db2 += db * db
  }
  const den = Math.sqrt(da2 * db2)
  return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den))
}

function returns(closes: number[]): number[] {
  const r: number[] = []
  for (let i = 1; i < closes.length; i++) {
    r.push(closes[i - 1] === 0 ? 0 : (closes[i] - closes[i - 1]) / closes[i - 1])
  }
  return r
}

function calcCorrelation(dxy: OHLCBar[], asset: OHLCBar[], n = 60): number {
  // Align by timestamp
  const mapB = new Map(asset.map(b => [b.time, b.close]))
  const aligned: [number, number][] = []
  for (const bar of dxy) {
    const cb = mapB.get(bar.time)
    if (cb !== undefined) aligned.push([bar.close, cb])
  }
  const recent = aligned.slice(-n)
  if (recent.length < 10) return 0
  const retA = returns(recent.map(p => p[0]))
  const retB = returns(recent.map(p => p[1]))
  return pearson(retA, retB)
}

function pctChange(bars: OHLCBar[]): number {
  if (bars.length < 2) return 0
  const first = bars[0].close
  const last  = bars[bars.length - 1].close
  return first === 0 ? 0 : (last - first) / first * 100
}

function todayChange(bars: OHLCBar[]): number {
  // Use last bar vs ~24h ago bar
  if (bars.length < 2) return 0
  const last = bars[bars.length - 1].close
  const ref  = bars[Math.max(0, bars.length - 24)].close
  return ref === 0 ? 0 : (last - ref) / ref * 100
}

/* ── Narrative engine ────────────────────────────────────── */
interface AssetState { sym: string; label: string; change: number; corr: number; bars: OHLCBar[] }

function buildNarrative(dxyChange: number, assets: AssetState[]): { headline: string; bullets: string[] } {
  const bullets: string[] = []
  const dir = dxyChange > 0 ? "stärker" : "schwächer"
  const dirEmoji = dxyChange > 0 ? "📈" : "📉"

  const headline = Math.abs(dxyChange) < 0.05
    ? "DXY seitwärts — kein klarer Richtungsimpuls."
    : `${dirEmoji} DXY ${dxyChange > 0 ? "+" : ""}${dxyChange.toFixed(2)}% — Dollar wird ${dir}.`

  const eurusd = assets.find(a => a.sym === "EUR/USD")
  const gbpusd = assets.find(a => a.sym === "GBP/USD")
  const gold   = assets.find(a => a.sym === "XAU/USD")
  const nas    = assets.find(a => a.sym === "US100")

  if (eurusd) {
    if (Math.abs(eurusd.corr) < 0.4) {
      bullets.push(`⚠️ EUR/USD entkoppelt von DXY (corr ${eurusd.corr.toFixed(2)}) — interne EUR-Faktoren dominieren (EZB, Datenlage).`)
    } else if (dxyChange > 0.15 && eurusd.change < -0.05) {
      bullets.push(`🔴 EUR/USD unter Druck (${eurusd.change.toFixed(2)}%) — typische inverse Reaktion auf Dollar-Stärke.`)
    } else if (dxyChange < -0.15 && eurusd.change > 0.05) {
      bullets.push(`🟢 EUR/USD profitiert vom schwachen Dollar (+${eurusd.change.toFixed(2)}%) — inverse Korrelation aktiv.`)
    }
  }

  if (gbpusd) {
    if (Math.abs(gbpusd.corr) < 0.35) {
      bullets.push(`⚠️ GBP/USD entkoppelt (corr ${gbpusd.corr.toFixed(2)}) — UK-spezifische Faktoren wirken.`)
    }
  }

  if (gold) {
    if (dxyChange > 0.2 && gold.change > 0.1) {
      bullets.push(`⚡ Gold steigt trotz starkem Dollar (+${gold.change.toFixed(2)}%) — Safe-Haven-Nachfrage dominiert, erhöhtes Marktrisiko.`)
    } else if (dxyChange > 0.2 && gold.change < -0.05) {
      bullets.push(`🔴 Gold fällt mit starkem Dollar (${gold.change.toFixed(2)}%) — klassische inverse Reaktion.`)
    } else if (dxyChange < -0.15 && gold.change > 0.15) {
      bullets.push(`🟢 Gold steigt mit schwachem Dollar (+${gold.change.toFixed(2)}%) — doppelter Rückenwind.`)
    }
    if (Math.abs(gold.corr) < 0.3) {
      bullets.push(`📊 Gold-DXY-Korrelation schwach (${gold.corr.toFixed(2)}) — Safe-Haven-Flows überlagern den USD-Effekt.`)
    }
  }

  if (nas) {
    if (nas.change > 0.5 && dxyChange > 0.2) {
      bullets.push(`🟡 Nasdaq und Dollar steigen gleichzeitig — Risk-On mit USD-Stärke (seltenes Setup, oft nicht nachhaltig).`)
    } else if (nas.change < -0.5 && dxyChange > 0.2) {
      bullets.push(`🔴 Risk-Off: Nasdaq fällt (${nas.change.toFixed(2)}%), Dollar steigt — Flight-to-Safety.`)
    } else if (nas.change > 0.5 && dxyChange < -0.1) {
      bullets.push(`🟢 Risk-On: Nasdaq stark (+${nas.change.toFixed(2)}%), Dollar schwach — klassisches Risk-On-Umfeld.`)
    }
  }

  if (bullets.length === 0) {
    bullets.push("Keine signifikante Entkopplung oder ungewöhnliche Intermarket-Bewegungen erkennbar.")
  }

  return { headline, bullets }
}

/* ── Sparkline SVG ───────────────────────────────────────── */
function Sparkline({ bars, color }: { bars: OHLCBar[]; color: string }) {
  if (bars.length < 2) return <div className="w-full h-full bg-white/[0.02] rounded" />
  const closes = bars.map(b => b.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const W = 200, H = 50, pad = 2
  const pts = closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (c - min) / range) * (H - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" ")
  const firstClose = closes[0]
  const lastClose  = closes[closes.length - 1]
  const bullish = lastClose >= firstClose
  const lineColor = bullish ? "#00ff88" : "#ff3d5a"
  // Area fill path
  const areaPath = `M ${pad},${H} L ${closes.map((c, i) => {
    const x = pad + (i / (closes.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (c - min) / range) * (H - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(" L ")} L ${W - pad},${H} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W - pad} cy={pad + (1 - (lastClose - min) / range) * (H - pad * 2)} r="2.5" fill={lineColor} />
    </svg>
  )
}

/* ── Correlation badge ───────────────────────────────────── */
function CorrBadge({ value }: { value: number }) {
  const abs = Math.abs(value)
  const strength = abs >= 0.7 ? "Stark" : abs >= 0.4 ? "Mittel" : "Schwach"
  const bg = abs >= 0.7
    ? value < 0 ? "rgba(255,61,90,0.18)" : "rgba(0,255,136,0.18)"
    : "rgba(255,255,255,0.07)"
  const col = abs >= 0.7
    ? value < 0 ? "#ff3d5a" : "#00ff88"
    : "#8892a4"

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] num font-semibold" style={{ background: bg, color: col }}>
      <span>{value >= 0 ? "+" : ""}{value.toFixed(2)}</span>
      <span className="text-[9px] opacity-70">{strength}</span>
    </div>
  )
}

/* ── Mini asset card ─────────────────────────────────────── */
interface AssetCardProps {
  label: string
  sym: string
  color: string
  note: string
  bars: OHLCBar[]
  corr: number
  loading: boolean
}

function AssetCard({ label, sym, color, note, bars, corr, loading }: AssetCardProps) {
  const change = todayChange(bars)
  const last   = bars.length ? bars[bars.length - 1].close : 0
  const bullish = change >= 0

  return (
    <div className="panel rounded-xl p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[12px] font-semibold text-white">{label}</div>
          <div className="text-[9px] text-mute mt-0.5">{sym}</div>
        </div>
        <CorrBadge value={corr} />
      </div>

      <div className="h-[52px] w-full">
        {loading
          ? <div className="w-full h-full bg-white/[0.03] rounded animate-pulse" />
          : <Sparkline bars={bars} color={color} />}
      </div>

      <div className="flex items-center justify-between">
        <div className="num text-[12px] font-semibold text-white">
          {last > 0 ? last.toFixed(last > 100 ? 2 : 4) : "—"}
        </div>
        <div className="num text-[11px] font-medium" style={{ color: bullish ? "#00ff88" : "#ff3d5a" }}>
          {bullish ? "+" : ""}{change.toFixed(2)}%
        </div>
      </div>

      <div className="text-[9px] text-mute leading-tight">{note}</div>
    </div>
  )
}

/* ── Main View ───────────────────────────────────────────── */
export default function IntermarketView() {
  const [tf, setTf] = useState<Timeframe>("H1")
  const [dxyBars,  setDxyBars]  = useState<OHLCBar[]>([])
  const [assetBars, setAssetBars] = useState<Record<string, OHLCBar[]>>({})
  const [loadingDxy,   setLoadingDxy]   = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volRef    = useRef<any>(null)

  // Fetch DXY bars
  useEffect(() => {
    setLoadingDxy(true)
    fetchBars("DXY", tf, 200)
      .then(bars => { setDxyBars(bars); setLoadingDxy(false) })
      .catch(() => setLoadingDxy(false))
  }, [tf])

  // Fetch correlated asset bars
  useEffect(() => {
    setLoadingAssets(true)
    Promise.all(
      CORR_ASSETS.map(a => fetchBars(a.sym, tf, 200).then(bars => ({ sym: a.sym, bars })).catch(() => ({ sym: a.sym, bars: [] as OHLCBar[] })))
    ).then(results => {
      const map: Record<string, OHLCBar[]> = {}
      results.forEach(r => { map[r.sym] = r.bars })
      setAssetBars(map)
      setLoadingAssets(false)
    })
  }, [tf])

  // Init lightweight-charts for DXY
  useEffect(() => {
    if (!containerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any, candle: any, vol: any, ro: ResizeObserver

    import("lightweight-charts").then(lc => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries } = lc as any

      chart = createChart(containerRef.current!, {
        layout: {
          background: { type: ColorType.Solid, color: "#070a12" },
          textColor: "#4a5568",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.025)" },
          horzLines: { color: "rgba(255,255,255,0.025)" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "rgba(255,255,255,0.15)", style: 3, labelBackgroundColor: "#1a2035" },
          horzLine: { color: "rgba(255,255,255,0.15)", style: 3, labelBackgroundColor: "#1a2035" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.05)", scaleMargins: { top: 0.06, bottom: 0.22 } },
        timeScale: { borderColor: "rgba(255,255,255,0.05)", timeVisible: true, secondsVisible: false },
        handleScroll: true,
        handleScale: true,
      })
      chartRef.current = chart

      candle = chart.addSeries(CandlestickSeries, {
        upColor: "#00ff88", downColor: "#ff3d5a",
        borderUpColor: "#00ff88", borderDownColor: "#ff3d5a",
        wickUpColor: "rgba(0,255,136,0.55)", wickDownColor: "rgba(255,61,90,0.55)",
        priceLineVisible: false,
      })
      candleRef.current = candle

      vol = chart.addSeries(HistogramSeries, {
        color: "#1d2531",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        priceLineVisible: false,
        lastValueVisible: false,
      })
      vol.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } })
      volRef.current = vol

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
      chartRef.current  = null
      candleRef.current = null
      volRef.current    = null
    }
  }, [])

  // Feed DXY data into chart
  useEffect(() => {
    if (!candleRef.current || !dxyBars.length) return
    const cd = dxyBars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
    const vd = dxyBars.map(b => ({
      time: b.time, value: b.volume ?? 0,
      color: b.close >= b.open ? "rgba(0,255,136,0.18)" : "rgba(255,61,90,0.18)",
    }))
    candleRef.current.setData(cd)
    volRef.current?.setData(vd)
    chartRef.current?.timeScale().fitContent()
  }, [dxyBars])

  // Derived values
  const dxyLast    = dxyBars.length ? dxyBars[dxyBars.length - 1].close : 0
  const dxyChange  = todayChange(dxyBars)
  const dxyPct24h  = pctChange(dxyBars.slice(-24))
  const dxyBullish = dxyChange >= 0

  const assetStates: AssetState[] = CORR_ASSETS.map(a => ({
    sym:    a.sym,
    label:  a.label,
    change: todayChange(assetBars[a.sym] ?? []),
    corr:   calcCorrelation(dxyBars, assetBars[a.sym] ?? []),
    bars:   assetBars[a.sym] ?? [],
  }))

  const narrative = buildNarrative(dxyChange, assetStates)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">

      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <div className="text-[15px] font-semibold text-white">Intermarket-Analyse</div>
          <div className="text-[11px] text-mute mt-0.5">DXY · Korrelationen · Markt-Narrative</div>
        </div>
        <select
          value={tf}
          onChange={e => setTf(e.target.value as Timeframe)}
          className="h-7 px-2 rounded-md glass text-[11px] font-medium num text-white border border-white/[0.08]
            bg-ink-900 cursor-pointer focus:outline-none focus:border-accent-blue/50 transition"
        >
          {TIMEFRAMES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* DXY Summary strip */}
      <div className="panel rounded-xl p-3 flex items-center gap-6 shrink-0">
        <div>
          <div className="text-[10px] text-mute tracking-widest uppercase mb-0.5">US Dollar Index</div>
          <div className="text-[24px] font-bold num text-white">{dxyLast > 0 ? dxyLast.toFixed(3) : "—"}</div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] text-mute">24h Änderung</div>
          <div className="num text-[16px] font-semibold" style={{ color: dxyBullish ? "#00ff88" : "#ff3d5a" }}>
            {dxyBullish ? "+" : ""}{dxyChange.toFixed(3)}%
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[10px] text-mute">Periode ({tf}×{Math.min(dxyBars.length, 24)} Bars)</div>
          <div className="num text-[13px] font-medium" style={{ color: dxyPct24h >= 0 ? "#00ff88" : "#ff3d5a" }}>
            {dxyPct24h >= 0 ? "+" : ""}{dxyPct24h.toFixed(3)}%
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${loadingDxy ? "bg-amber-400 animate-pulse" : "bg-accent-green"}`} />
          <div className="text-[10px] text-mute">{loadingDxy ? "Lädt…" : `${dxyBars.length} Bars`}</div>
        </div>
      </div>

      {/* DXY Chart */}
      <div className="panel rounded-xl overflow-hidden shrink-0" style={{ height: 280 }}>
        <div className="px-3 pt-2 pb-0 flex items-center gap-2 border-b border-white/[0.04]">
          <div className="text-[10px] tracking-widest uppercase text-mute pb-2">DXY Chart · {tf}</div>
        </div>
        <div ref={containerRef} className="w-full" style={{ height: 244 }} />
        {loadingDxy && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/70">
            <div className="w-6 h-6 border-2 border-white/10 border-t-accent-blue rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Correlated markets grid */}
      <div>
        <div className="text-[10px] tracking-widest uppercase text-mute mb-2">Korrelierte Märkte</div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {CORR_ASSETS.map(a => (
            <AssetCard
              key={a.sym}
              label={a.label}
              sym={a.sym}
              color={a.color}
              note={a.note}
              bars={assetBars[a.sym] ?? []}
              corr={assetStates.find(s => s.sym === a.sym)?.corr ?? 0}
              loading={loadingAssets}
            />
          ))}
        </div>
      </div>

      {/* Correlation legend */}
      <div className="panel rounded-xl p-3 shrink-0">
        <div className="text-[10px] tracking-widest uppercase text-mute mb-2">Korrelations-Legende</div>
        <div className="grid grid-cols-3 gap-4 text-[10px]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(0,255,136,0.4)" }} />
            <span className="text-white font-medium">0.7–1.0</span>
            <span className="text-mute">Starke positive Korr.</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(255,255,255,0.15)" }} />
            <span className="text-white font-medium">0.0–0.4</span>
            <span className="text-mute">Schwach / entkoppelt</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(255,61,90,0.4)" }} />
            <span className="text-white font-medium">−0.7–−1.0</span>
            <span className="text-mute">Starke inverse Korr.</span>
          </div>
        </div>
        <div className="mt-2 text-[9px] text-mute">
          Berechnet auf Pearson-Korrelation der stündlichen Returns (letzte 60 Bars, Timestamp-aligned).
        </div>
      </div>

      {/* Market Narrative */}
      <div className="panel rounded-xl p-4 shrink-0">
        <div className="text-[10px] tracking-widest uppercase text-mute mb-3">Markt-Narrative</div>
        <div className="text-[13px] font-semibold text-white mb-3">{narrative.headline}</div>
        <div className="flex flex-col gap-2">
          {narrative.bullets.map((b, i) => (
            <div key={i} className="text-[12px] text-[#8892a4] leading-relaxed">{b}</div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-white/[0.04] text-[9px] text-mute">
          Automatisch generiert aus DXY-Bewegung, Korrelation und Asset-Performance. Kein Handelsrat.
        </div>
      </div>

    </div>
  )
}
