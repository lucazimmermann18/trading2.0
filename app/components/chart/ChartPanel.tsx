"use client"
import { useEffect, useRef, useState } from "react"
import type { Pair, Timeframe } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { fetchBars } from "@/app/lib/twelvedata"

const TIMEFRAMES: Timeframe[] = ["M1", "M5", "M15", "H1", "H4", "D1"]

interface Props {
  pair: Pair
  timeframe: Timeframe
  setTimeframe: (tf: Timeframe) => void
}

export default function ChartPanel({ pair, timeframe, setTimeframe }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candleRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const volumeRef = useRef<any>(null)
  const [loading, setLoading] = useState(true)
  const [chartType, setChartType] = useState<"candle" | "line">("candle")

  const trade = pair.status === "TRADE"
  const pxColor = pair.history.length >= 2
    ? pair.history[pair.history.length - 1].close >= pair.history[pair.history.length - 2].close
      ? "#00ff88" : "#ff3d5a"
    : "#00d4ff"

  // Init chart once
  useEffect(() => {
    if (!containerRef.current) return
    let chart: any, candle: any, line: any, vol: any

    import("lightweight-charts").then(lc => {
      const { createChart, ColorType, CrosshairMode, CandlestickSeries, LineSeries, HistogramSeries } = lc as any

      chart = createChart(containerRef.current!, {
        layout: { background: { type: ColorType.Solid, color: "#0a0e1a" }, textColor: "#5a6779" },
        grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
        crosshair: { mode: CrosshairMode.Normal, vertLine: { color: "rgba(255,255,255,0.15)", style: 3 }, horzLine: { color: "rgba(255,255,255,0.15)", style: 3 } },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", scaleMargins: { top: 0.06, bottom: 0.22 } },
        timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
        handleScroll: true, handleScale: true,
      })
      chartRef.current = chart

      // v5: chart.addSeries(SeriesType, options)
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

      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight })
        }
      })
      if (containerRef.current) ro.observe(containerRef.current)

      return () => { ro.disconnect(); chart.remove() }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load data when pair or timeframe changes
  useEffect(() => {
    if (!candleRef.current) return
    setLoading(true)
    const load = async () => {
      try {
        let bars = await fetchBars(pair.sym, timeframe, 150)
        if (!bars.length) bars = pair.history
        const cd = bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
        const ld = bars.map(b => ({ time: b.time, value: b.close }))
        const vd = bars.map(b => ({ time: b.time, value: b.volume ?? 0, color: b.close >= b.open ? "rgba(0,255,136,0.22)" : "rgba(255,61,90,0.22)" }))
        candleRef.current?.setData(cd)
        lineRef.current?.setData(ld)
        volumeRef.current?.setData(vd)
        chartRef.current?.timeScale().fitContent()
      } catch {
        const bars = pair.history
        const cd = bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close }))
        const ld = bars.map(b => ({ time: b.time, value: b.close }))
        const vd = bars.map(b => ({ time: b.time, value: b.volume ?? 0, color: b.close >= b.open ? "rgba(0,255,136,0.22)" : "rgba(255,61,90,0.22)" }))
        candleRef.current?.setData(cd)
        lineRef.current?.setData(ld)
        volumeRef.current?.setData(vd)
        chartRef.current?.timeScale().fitContent()
      } finally {
        setLoading(false)
      }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pair.px])

  // Toggle chart type
  useEffect(() => {
    if (!candleRef.current || !lineRef.current) return
    if (chartType === "candle") {
      candleRef.current.applyOptions({ visible: true })
      lineRef.current.applyOptions({ visible: false })
    } else {
      candleRef.current.applyOptions({ visible: false })
      lineRef.current.applyOptions({ visible: true })
    }
  }, [chartType])

  return (
    <div className={`flex-1 flex flex-col panel border-t-0 border-b-0 m-2 rounded-xl overflow-hidden relative ${trade ? "animate-glowBorder" : ""}`}>
      {/* Toolbar */}
      <div className="h-12 flex items-center px-4 border-b hairline gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-[15px] font-semibold text-white tracking-tight">{pair.sym}</div>
          <div className="text-[10px] text-mute tracking-[0.16em] uppercase">{pair.name}</div>
        </div>

        <div className="flex items-center gap-3 ml-2">
          <div className="num text-[16px] font-semibold" style={{ color: pxColor }}>
            {fmt(pair.px, pair.digits)}
          </div>
        </div>

        {trade && pair.signal && (
          <div className={`flex items-center gap-1.5 px-2.5 h-6 rounded-[5px] text-[10px] font-bold tracking-[0.18em]
            ${pair.signal.side === "BUY" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"}`}>
            ⚡ {pair.signal.side} · conf {pair.signal.confidence}%
          </div>
        )}

        <div className="flex-1" />

        {/* Chart type */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          <button
            onClick={() => setChartType("candle")}
            className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium transition ${chartType === "candle" ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}
          >Candles</button>
          <button
            onClick={() => setChartType("line")}
            className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium transition ${chartType === "line" ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}
          >Line</button>
        </div>

        {/* Timeframe */}
        <div className="flex items-center gap-1 px-1 py-0.5 rounded-md glass">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`h-7 px-2.5 rounded-[5px] text-[11px] font-medium num transition
                ${timeframe === tf ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}
            >{tf}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative min-h-0">
        <div ref={containerRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-900/80">
            <div className="w-8 h-8 border-2 border-white/10 border-t-accent-blue rounded-full animate-spin" />
          </div>
        )}
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
