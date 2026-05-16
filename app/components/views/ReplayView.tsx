"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import type { Pair, HistoryEntry } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { fetchBars } from "@/app/lib/twelvedata"
import { setCachedBars } from "@/app/lib/bar-cache"

interface Props { history: HistoryEntry[]; pairs: Pair[] }

const LIFECYCLE: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: "ACTIVE",  color: "#00d4ff" },
  TP1:       { label: "TP1 ✓",  color: "#00ff88" },
  TP2:       { label: "TP2 ✓",  color: "#00ff88" },
  SL:        { label: "SL ✗",   color: "#ff3d5a" },
  CLOSED:    { label: "CLOSED", color: "#a78bfa" },
  CANCELLED: { label: "VOID",   color: "#5a6779" },
  EXPIRED:   { label: "EXPIRED",color: "#f59e0b" },
}

function LifecycleBadge({ state }: { state: string }) {
  const cfg = LIFECYCLE[state] ?? { label: state, color: "#5a6779" }
  return (
    <span className="px-2 h-[22px] inline-flex items-center rounded-[4px] text-[10px] font-bold tracking-[0.16em]"
      style={{ background: cfg.color + "22", color: cfg.color }}>{cfg.label}</span>
  )
}

function KVMini({ label, value, color = "#ffffff" }: { label: string; value: string; color?: string }) {
  return (
    <div className="px-3 py-2 rounded-md bg-white/[0.025]">
      <div className="text-[9px] text-mute tracking-[0.16em] uppercase">{label}</div>
      <div className="num text-[14px] mt-0.5 font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

type OHLCBar = { open: number; high: number; low: number; close: number; time?: number }

function ReplayChart({ signal, bars: sourceBars, onLoadBars, loading }: {
  signal: HistoryEntry
  bars: OHLCBar[]
  onLoadBars: () => void
  loading: boolean
}) {
  const { data, entryBarIdx } = useMemo(() => {
    if (sourceBars.length < 10) return { data: [] as OHLCBar[], entryBarIdx: -1 }
    const sigTimeSec = Math.floor(signal.time / 1000)
    let closestIdx = sourceBars.length - 1
    let minDiff = Infinity
    for (let i = 0; i < sourceBars.length; i++) {
      const diff = Math.abs((sourceBars[i]?.time ?? 0) - sigTimeSec)
      if (diff < minDiff) { minDiff = diff; closestIdx = i }
    }
    const before = Math.min(closestIdx, 50)
    const after  = Math.min(sourceBars.length - 1 - closestIdx, 15)
    const sliced = sourceBars.slice(closestIdx - before, closestIdx + after + 1)
    return { data: sliced as OHLCBar[], entryBarIdx: before }
  }, [sourceBars, signal.time])

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-[260px] rounded-md bg-white/[0.02] border border-white/[0.04]">
        <div className="text-center space-y-3">
          <div className="text-mute text-[12px]">Chart data not in memory</div>
          <button
            onClick={onLoadBars}
            disabled={loading}
            className={`h-8 px-4 rounded-md text-[11px] font-semibold tracking-[0.14em] transition flex items-center gap-2 mx-auto
              ${loading ? "bg-accent-blue/10 text-accent-blue/50 cursor-not-allowed" : "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25"}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Loading…
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Load Chart Data
              </>
            )}
          </button>
          <div className="text-mute text-[10px] opacity-50">Fetches live H1 bars from Twelve Data</div>
        </div>
      </div>
    )
  }

  const W = 900, H = 230, pad = 8
  const allPrices = data.flatMap(d => [d.high, d.low])
  const min = Math.min(...allPrices, signal.sl, signal.tp2) - Math.abs(signal.entry - signal.sl) * 0.05
  const max = Math.max(...allPrices, signal.sl, signal.tp2) + Math.abs(signal.entry - signal.sl) * 0.05
  const cw = (W - pad * 2) / Math.max(data.length, 1)
  const yv = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2)

  const entryX = entryBarIdx >= 0 ? pad + entryBarIdx * cw + cw / 2 : -1

  return (
    <div className="relative">
      <div className="absolute top-2 left-2 z-10 px-2 h-5 rounded flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] bg-accent-green/15 text-accent-green">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-green"/>
        LIVE DATA
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[260px] block rounded-md overflow-hidden">
        <rect width={W} height={H} fill="rgba(10,14,26,0.7)" />

        {entryX > 0 && (
          <line x1={entryX} x2={entryX} y1={pad} y2={H - pad}
            stroke="rgba(0,212,255,0.18)" strokeWidth="1" strokeDasharray="3 3" />
        )}

        <line x1={pad} x2={W - pad} y1={yv(signal.entry)} y2={yv(signal.entry)} stroke="#00d4ff" strokeWidth="1.5" />
        <line x1={pad} x2={W - pad} y1={yv(signal.sl)}    y2={yv(signal.sl)}    stroke="#ff3d5a" strokeWidth="1" strokeDasharray="5 4" />
        <line x1={pad} x2={W - pad} y1={yv(signal.tp1)}   y2={yv(signal.tp1)}   stroke="#00ff88" strokeWidth="1" strokeDasharray="5 4" />
        <line x1={pad} x2={W - pad} y1={yv(signal.tp2)}   y2={yv(signal.tp2)}   stroke="#00ff88" strokeWidth="1.4" strokeDasharray="5 4" />

        {data.map((b, i) => {
          const x = pad + i * cw
          const up = b.close >= b.open
          const isEntryBar = i === entryBarIdx
          const col = isEntryBar ? "#00d4ff" : up ? "#00ff88" : "#ff3d5a"
          const wickCol = isEntryBar ? "rgba(0,212,255,0.6)" : up ? "rgba(0,255,136,0.4)" : "rgba(255,61,90,0.4)"
          const bodyTop = yv(Math.max(b.open, b.close))
          const bodyH   = Math.max(1, Math.abs(yv(b.open) - yv(b.close)))
          return (
            <g key={i}>
              <line x1={x + cw / 2} x2={x + cw / 2} y1={yv(b.high)} y2={yv(b.low)}
                stroke={wickCol} strokeWidth="1" />
              <rect x={x + 1} y={bodyTop} width={Math.max(1, cw - 2)} height={bodyH}
                fill={col} opacity={isEntryBar ? "1" : "0.85"} />
            </g>
          )
        })}

        {data.map((b, i) => {
          if (!b.time || i % Math.max(1, Math.floor(data.length / 8)) !== 0) return null
          const x = pad + i * cw + cw / 2
          const label = new Date(b.time * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          return (
            <text key={i} x={x} y={H - 2} textAnchor="middle" fill="#5a6779"
              fontSize="7" fontFamily="JetBrains Mono, monospace">{label}</text>
          )
        })}

        {[
          { v: signal.entry, label: `ENTRY ${fmt(signal.entry, signal.digits)}`, col: "#00d4ff" },
          { v: signal.sl,    label: `SL ${fmt(signal.sl, signal.digits)}`,       col: "#ff3d5a" },
          { v: signal.tp1,   label: `TP1 ${fmt(signal.tp1, signal.digits)}`,     col: "#00ff88" },
          { v: signal.tp2,   label: `TP2 ${fmt(signal.tp2, signal.digits)}`,     col: "#00ff88" },
        ].map(({ v, label, col }) => (
          <text key={label} x={W - pad - 4} y={Math.max(14, Math.min(H - 12, yv(v) - 4))}
            textAnchor="end" fill={col} fontSize="9" fontFamily="JetBrains Mono, monospace" opacity="0.9">
            {label}
          </text>
        ))}
      </svg>
    </div>
  )
}

export default function ReplayView({ history, pairs }: Props) {
  const sorted = useMemo(() => [...history].sort((a, b) => a.time - b.time), [history])
  const total = sorted.length
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(600)
  const [loadedBars, setLoadedBars] = useState<Record<string, OHLCBar[]>>({})
  const [fetchingSym, setFetchingSym] = useState<string | null>(null)

  const loadBarsForSym = useCallback(async (sym: string) => {
    if (fetchingSym === sym) return
    setFetchingSym(sym)
    try {
      const bars = await fetchBars(sym, "H1", 220)
      if (bars.length) {
        setLoadedBars(prev => ({ ...prev, [sym]: bars as OHLCBar[] }))
        setCachedBars(sym, bars)
      }
    } catch { /* non-critical */ }
    setFetchingSym(null)
  }, [fetchingSym])

  useEffect(() => {
    if (!playing) return
    const i = setInterval(() => {
      setIdx(v => {
        if (v >= total - 1) { setPlaying(false); return v }
        return v + 1
      })
    }, speed)
    return () => clearInterval(i)
  }, [playing, total, speed])

  if (!total) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-mute">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <div className="text-[13px]">No history yet — run a scan first</div>
      </div>
    )
  }

  const s = sorted[idx]
  if (!s) return null
  const pnlColor = s.pnl_r == null ? "#5a6779" : s.pnl_r > 0 ? "#00ff88" : "#ff3d5a"

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="flex items-end justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-semibold text-white tracking-tight">Signal Replay</div>
            <div className="text-[11px] text-mute mt-0.5">Step through {total} historical signals — real market data only</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10.5px] text-mute">
          <span>Speed:</span>
          {[{ label: "0.5×", ms: 1200 }, { label: "1×", ms: 600 }, { label: "2×", ms: 300 }].map(sp => (
            <button key={sp.ms} onClick={() => setSpeed(sp.ms)}
              className={`h-7 px-2.5 rounded-[5px] text-[11px] num transition
                ${speed === sp.ms ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
              {sp.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="panel rounded-xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-mute">
                Signal {idx + 1} / {total}
              </div>
              <div className="text-[20px] font-semibold text-white tracking-tight mt-1 flex items-center gap-2">
                {s.sym}
                <span className={s.side === "BUY" ? "text-accent-green" : "text-accent-red"}>· {s.side}</span>
                <span className="text-mute text-[14px]">· {s.tf}</span>
              </div>
              <div className="text-[11px] text-mute mt-1">
                {new Date(s.time).toLocaleString()} · {s.skillset}
              </div>
            </div>
            <LifecycleBadge state={s.state} />
          </div>

          <div className="grid grid-cols-5 gap-2 mb-5">
            <KVMini label="Entry" value={fmt(s.entry, s.digits)} color="#00d4ff" />
            <KVMini label="SL"    value={fmt(s.sl,    s.digits)} color="#ff3d5a" />
            <KVMini label="TP1"   value={fmt(s.tp1,   s.digits)} color="#00ff88" />
            <KVMini label="TP2"   value={fmt(s.tp2,   s.digits)} color="#00ff88" />
            <KVMini label="P&L"
              value={s.pnl_r == null ? "—" : `${s.pnl_r > 0 ? "+" : ""}${s.pnl_r.toFixed(2)}R`}
              color={pnlColor} />
          </div>

          <ReplayChart
            signal={s}
            bars={((): OHLCBar[] => {
              const pair = pairs.find(p => p.sym === s.sym)
              if (pair && pair.history.length >= 10) return pair.history as OHLCBar[]
              return (loadedBars[s.sym] ?? []) as OHLCBar[]
            })()}
            onLoadBars={() => loadBarsForSym(s.sym)}
            loading={fetchingSym === s.sym}
          />

          <div className="mt-4 px-3 py-2.5 rounded-md bg-white/[0.02] border border-white/[0.05]">
            <div className="text-[9px] tracking-[0.18em] uppercase text-mute mb-1">AI Reasoning</div>
            <div className="text-[11.5px] text-white/80 leading-relaxed">{s.why}</div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => { setIdx(0); setPlaying(false) }}
              className="h-9 w-9 rounded-md border border-white/10 text-white hover:bg-white/[0.04] flex items-center justify-center transition"
              title="First"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5"/>
              </svg>
            </button>
            <button
              onClick={() => { setIdx(i => Math.max(0, i - 1)); setPlaying(false) }}
              className="h-9 w-9 rounded-md border border-white/10 text-white hover:bg-white/[0.04] flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button
              onClick={() => setPlaying(p => !p)}
              className={`h-9 px-5 rounded-md text-[11px] font-bold tracking-[0.18em] transition
                ${playing
                  ? "bg-accent-red/15 text-accent-red border border-accent-red/30"
                  : "bg-accent-blue/15 text-accent-blue border border-accent-blue/30"}`}
            >
              {playing ? "⏸ PAUSE" : "▶ PLAY"}
            </button>
            <button
              onClick={() => { setIdx(i => Math.min(total - 1, i + 1)); setPlaying(false) }}
              className="h-9 w-9 rounded-md border border-white/10 text-white hover:bg-white/[0.04] flex items-center justify-center transition"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
            <button
              onClick={() => { setIdx(total - 1); setPlaying(false) }}
              className="h-9 w-9 rounded-md border border-white/10 text-white hover:bg-white/[0.04] flex items-center justify-center transition"
              title="Last"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19"/>
              </svg>
            </button>

            <input
              type="range" min={0} max={total - 1} value={idx}
              onChange={e => { setIdx(+e.target.value); setPlaying(false) }}
              className="slider flex-1"
            />
            <div className="text-[10px] num text-mute whitespace-nowrap">
              {new Date(s.time).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
