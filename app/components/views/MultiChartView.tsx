"use client"
import { useMemo, useState } from "react"
import type { Pair } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"

interface Props {
  pairs: Pair[]
  onOpen: (id: number) => void
}

/* ---- Sparkline SVG path builder ---- */
function buildPath(history: Pair["history"]): string {
  const h = history.slice(-80)
  if (h.length < 2) return ""
  const min = Math.min(...h.map(b => b.low))
  const max = Math.max(...h.map(b => b.high))
  const W = 400, H = 110, pad = 6
  return h
    .map((b, i) => {
      const x = pad + (i / (h.length - 1)) * (W - pad * 2)
      const y = pad + (1 - (b.close - min) / (max - min || 1)) * (H - pad * 2)
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(" ")
}

/* ---- Signal level lines in SVG coordinates ---- */
function levelY(value: number, history: Pair["history"]): number {
  const h = history.slice(-80)
  const min = Math.min(...h.map(b => b.low))
  const max = Math.max(...h.map(b => b.high))
  return 6 + (1 - (value - min) / (max - min || 1)) * (110 - 12)
}

/* ---- Single mini chart card ---- */
function MiniChartCard({ pair, onOpen }: { pair: Pair; onOpen: () => void }) {
  const trade = pair.status === "TRADE"
  const path = useMemo(
    () => buildPath(pair.history),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pair.history.length, pair.history[pair.history.length - 1]?.close],
  )

  const first = pair.history[0]?.close ?? pair.px
  const d = pair.px - first
  const up = d >= 0
  const dPct = ((d / first) * 100).toFixed(2)
  const color = up ? "#00ff88" : "#ff3d5a"

  /* RSI colour */
  const rsiCol = pair.rsi >= 70 ? "#ff3d5a" : pair.rsi <= 30 ? "#00ff88" : "#ffb800"

  return (
    <div
      onClick={onOpen}
      className={`panel rounded-xl overflow-hidden cursor-pointer transition group
        hover:bg-white/[0.02] hover:border-white/15
        ${trade ? "animate-glowBorder" : ""}`}
    >
      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-semibold text-white tracking-tight">{pair.sym}</div>
          <span className="text-[9px] tracking-[0.16em] text-mute uppercase">{pair.group}</span>
        </div>
        {trade && pair.signal ? (
          <div
            className={`flex items-center gap-1 px-1.5 h-4 rounded-[3px] text-[9px] font-bold tracking-[0.14em] whitespace-nowrap
              ${pair.signal.side === "BUY"
                ? "bg-accent-green/20 text-accent-green"
                : "bg-accent-red/20 text-accent-red"}`}
          >
            ⚡ {pair.signal.side}
          </div>
        ) : (
          <div className="px-1.5 h-4 rounded-[3px] text-[9px] font-bold tracking-[0.14em] bg-white/[0.04] text-mute flex items-center whitespace-nowrap">
            NO TRADE
          </div>
        )}
      </div>

      {/* Price row */}
      <div className="px-3 pb-1 flex items-baseline gap-2">
        <div className="num text-[15px] font-semibold" style={{ color }}>{fmt(pair.px, pair.digits)}</div>
        <div className="num text-[10px]" style={{ color }}>
          {up ? "+" : ""}{fmt(d, pair.digits)} ({up ? "+" : ""}{dPct}%)
        </div>
      </div>

      {/* Sparkline SVG */}
      <svg viewBox="0 0 400 110" className="w-full h-[120px] block" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${pair.id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {path && (
          <path
            d={`${path} L${400 - 6},110 L6,110 Z`}
            fill={`url(#grad-${pair.id})`}
          />
        )}

        {/* Line */}
        {path && (
          <path
            d={path}
            stroke={color}
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Signal level lines */}
        {trade && pair.signal && (
          <>
            {[
              { v: pair.signal.entry, c: "#00d4ff", dash: "" },
              { v: pair.signal.sl,    c: "#ff3d5a", dash: "3 3" },
              { v: pair.signal.tp2,   c: "#00ff88", dash: "3 3" },
            ].map((ln, i) => {
              const y = levelY(ln.v, pair.history)
              if (y < 0 || y > 115) return null
              return (
                <line
                  key={i}
                  x1="0" x2="400"
                  y1={y} y2={y}
                  stroke={ln.c}
                  strokeWidth="0.8"
                  strokeDasharray={ln.dash}
                  opacity="0.65"
                />
              )
            })}
            {/* Entry label */}
            <text
              x="6"
              y={Math.max(10, Math.min(105, levelY(pair.signal.entry, pair.history) - 3))}
              fill="#00d4ff"
              fontSize="8"
              fontFamily="JetBrains Mono, monospace"
              opacity="0.8"
            >
              E {fmt(pair.signal.entry, pair.digits)}
            </text>
          </>
        )}

        {/* Latest price dot */}
        {path && (() => {
          const last = pair.history.slice(-1)[0]
          if (!last) return null
          const h = pair.history.slice(-80)
          const min = Math.min(...h.map(b => b.low))
          const max = Math.max(...h.map(b => b.high))
          const cy = 6 + (1 - (last.close - min) / (max - min || 1)) * (110 - 12)
          return (
            <circle cx={400 - 6} cy={cy} r="3" fill={color} />
          )
        })()}
      </svg>

      {/* Footer stats */}
      <div className="px-3 py-2 flex items-center justify-between text-[9.5px] text-mute num border-t hairline bg-white/[0.015]">
        <span>
          RSI{" "}
          <span className="font-semibold" style={{ color: rsiCol }}>
            {pair.rsi.toFixed(0)}
          </span>
        </span>
        <span>sp {pair.spread.toFixed(pair.spread < 1 ? 2 : 1)}</span>
        {trade && pair.signal ? (
          <span className="text-accent-blue">conf {pair.signal.confidence}%</span>
        ) : (
          <span className="tracking-[0.12em] uppercase">{pair.group}</span>
        )}
      </div>
    </div>
  )
}

/* ---- Page header shared atom ---- */
function PageHeader({
  icon,
  title,
  sub,
  right,
}: {
  icon: React.ReactNode
  title: string
  sub?: string
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-end justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-[18px] font-semibold text-white tracking-tight">{title}</div>
          {sub && <div className="text-[11px] text-mute tracking-[0.06em] mt-0.5">{sub}</div>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  )
}

/* ---- Empty state ---- */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-mute">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
        <rect x="3" y="3" width="8" height="8" rx="1"/>
        <rect x="13" y="3" width="8" height="8" rx="1"/>
        <rect x="3" y="13" width="8" height="8" rx="1"/>
        <rect x="13" y="13" width="8" height="8" rx="1"/>
      </svg>
      <div className="text-[13px]">No active pairs</div>
      <div className="text-[11px]">Enable pairs in the sidebar to see them here</div>
    </div>
  )
}

/* ---- Stats bar above grid ---- */
function StatsBar({ pairs }: { pairs: Pair[] }) {
  const active = pairs.filter(p => p.active)
  const trades = active.filter(p => p.status === "TRADE")
  const avgConf = active.length
    ? Math.round(active.reduce((s, p) => s + (p.signal?.confidence ?? p.confidence ?? 0), 0) / active.length)
    : 0
  const bulls = trades.filter(p => p.signal?.side === "BUY").length
  const bears = trades.filter(p => p.signal?.side === "SELL").length

  return (
    <div className="px-6 py-3 flex items-center gap-6 border-b hairline shrink-0">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-mute tracking-[0.14em] uppercase">Active</span>
        <span className="num font-semibold text-white">{active.length}</span>
      </div>
      <div className="w-px h-4 bg-white/10" />
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-mute tracking-[0.14em] uppercase">Signals</span>
        <span className="num font-semibold text-white">{trades.length}</span>
      </div>
      <div className="w-px h-4 bg-white/10" />
      <div className="flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="dot bg-accent-green" />
          <span className="num font-semibold text-accent-green">{bulls} BUY</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="dot bg-accent-red" />
          <span className="num font-semibold text-accent-red">{bears} SELL</span>
        </span>
      </div>
      <div className="w-px h-4 bg-white/10" />
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-mute tracking-[0.14em] uppercase">Avg Confidence</span>
        <span
          className="num font-semibold"
          style={{ color: avgConf >= 70 ? "#00ff88" : avgConf >= 40 ? "#ffb800" : "#ff3d5a" }}
        >
          {avgConf}%
        </span>
      </div>
      <div className="ml-auto flex items-center gap-1.5 text-[10px] text-accent-green">
        <span className="dot bg-accent-green animate-pulseDot" style={{ boxShadow: "0 0 6px rgba(0,255,136,0.8)" }} />
        LIVE
      </div>
    </div>
  )
}

/* ---- Main export ---- */
export default function MultiChartView({ pairs, onOpen }: Props) {
  const [layout, setLayout] = useState<"2x2" | "3x2">("2x2")
  const cols = layout === "2x2" ? 2 : 3
  const limit = layout === "2x2" ? 4 : 6
  const active = pairs.filter(p => p.active).slice(0, limit)

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <PageHeader
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="8" height="8" rx="1"/>
            <rect x="13" y="3" width="8" height="8" rx="1"/>
            <rect x="3" y="13" width="8" height="8" rx="1"/>
            <rect x="13" y="13" width="8" height="8" rx="1"/>
          </svg>
        }
        title="Multi-Chart Grid"
        sub="Watch up to 6 active pairs simultaneously — click any card to open full chart"
        right={
          <div className="flex items-center gap-1 px-1 py-1 rounded-md glass">
            {(["2x2", "3x2"] as const).map(l => (
              <button
                key={l}
                onClick={() => setLayout(l)}
                className={`h-7 px-3 rounded-[5px] text-[11px] font-medium num transition
                  ${layout === l ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}
              >
                {l}
              </button>
            ))}
          </div>
        }
      />

      <StatsBar pairs={pairs} />

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {active.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="grid gap-3 h-full"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {active.map(p => (
              <MiniChartCard
                key={p.id}
                pair={p}
                onOpen={() => onOpen(p.id)}
              />
            ))}

            {/* Ghost placeholders so grid always looks full */}
            {active.length < limit &&
              Array.from({ length: limit - active.length }).map((_, i) => (
                <div
                  key={`ghost-${i}`}
                  className="panel rounded-xl border-dashed opacity-30 flex items-center justify-center min-h-[200px]"
                >
                  <div className="text-[11px] text-mute text-center">
                    <div className="mb-1 opacity-50">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </div>
                    Enable pair in sidebar
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
