"use client"
import { useMemo, useState } from "react"
import type { HistoryEntry } from "@/app/lib/types"
import { aggregatePerformance, type PerfRow } from "@/app/lib/market-data"

interface Props { history: HistoryEntry[] }

function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>
          </svg>
        </div>
        <div>
          <div className="text-[18px] font-semibold text-white tracking-tight">{title}</div>
          {sub && <div className="text-[11px] text-mute mt-0.5">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  )
}

function StatCard({ label, value, sub, accent = "#ffffff" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="panel rounded-lg p-4">
      <div className="text-[10px] tracking-[0.18em] uppercase text-mute mb-2">{label}</div>
      <div className="num text-[22px] font-semibold leading-none" style={{ color: accent }}>{value}</div>
      {sub && <div className="text-[10.5px] text-mute mt-1.5">{sub}</div>}
    </div>
  )
}

function EquityCurve({ data }: { data: { r: number }[] }) {
  if (data.length < 2) return (
    <div className="flex items-center justify-center h-[200px] text-mute text-[12px]">No closed trades yet</div>
  )
  const W = 900, H = 180, pad = 10
  const min = Math.min(0, ...data.map(d => d.r))
  const max = Math.max(0, ...data.map(d => d.r))
  const toY = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2)
  const path = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${toY(d.r).toFixed(1)}`
  }).join(" ")
  const zeroY = toY(0)
  const lastR = data[data.length - 1].r
  const up = lastR >= 0
  const col = up ? "#00ff88" : "#ff3d5a"
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]">
      <defs>
        <linearGradient id="eqGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.25" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map(p => (
        <line key={p} x1={pad} x2={W - pad}
          y1={pad + p * (H - pad * 2)} y2={pad + p * (H - pad * 2)}
          stroke="rgba(255,255,255,0.04)" />
      ))}
      <line x1={pad} x2={W - pad} y1={zeroY} y2={zeroY}
        stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
      <path d={`${path} L${W - pad},${zeroY} L${pad},${zeroY} Z`} fill="url(#eqGrad)" />
      <path d={path} stroke={col} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x={W - pad} y={pad + 12} textAnchor="end"
        fill={col} fontSize="14" fontWeight="600" fontFamily="JetBrains Mono, monospace">
        {up ? "+" : ""}{lastR.toFixed(1)}R
      </text>
    </svg>
  )
}

function SplitBars({ rows }: { rows: PerfRow[] }) {
  const maxAbs = Math.max(...rows.map(r => Math.abs(r.totalR)), 1)
  if (!rows.length) return <div className="text-mute text-[11px] py-4 text-center">No data</div>
  return (
    <div className="space-y-3">
      {rows.map(r => {
        const w = (Math.abs(r.totalR) / maxAbs) * 100
        const pos = r.totalR >= 0
        return (
          <div key={r.key}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <div className="text-white truncate max-w-[120px]">{r.key}</div>
              <div className="flex items-center gap-3 text-mute num shrink-0">
                <span>{r.total} · {(r.winRate * 100).toFixed(0)}%</span>
                <span className="w-12 text-right font-semibold" style={{ color: pos ? "#00ff88" : "#ff3d5a" }}>
                  {pos ? "+" : ""}{r.totalR.toFixed(1)}R
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${w}%`, background: pos ? "#00ff88" : "#ff3d5a", boxShadow: `0 0 6px ${pos ? "#00ff88" : "#ff3d5a"}40` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RDistribution({ history }: { history: HistoryEntry[] }) {
  const bins = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3]
  const counts = bins.map((b, i) => {
    const next = bins[i + 1] ?? Infinity
    return history.filter(h => h.pnl_r != null && h.pnl_r >= b && h.pnl_r < next).length
  })
  const maxCount = Math.max(...counts, 1)
  return (
    <div className="flex items-end gap-1.5 h-[140px]">
      {bins.map((b, i) => {
        const pct = (counts[i] / maxCount) * 100
        const pos = b >= 0
        const col = pos ? "rgba(0,255,136,0.55)" : "rgba(255,61,90,0.55)"
        const border = pos ? "#00ff88" : "#ff3d5a"
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            {counts[i] > 0 && (
              <div className="text-[9px] text-mute num mb-1">{counts[i]}</div>
            )}
            <div className="w-full rounded-t-sm transition-all"
              style={{ height: `${Math.max(2, pct)}%`, background: col, borderTop: `1px solid ${border}` }} />
            <div className="text-[8.5px] text-mute num mt-1.5">{b}R</div>
          </div>
        )
      })}
    </div>
  )
}

const RANGES = ["7D", "30D", "All"] as const

export default function PerformanceView({ history }: Props) {
  const [range, setRange] = useState<typeof RANGES[number]>("All")
  const filtered = useMemo(() => {
    if (range === "All") return history
    const days = range === "7D" ? 7 : 30
    const cutoff = Date.now() - days * 86400000
    return history.filter(h => h.time >= cutoff)
  }, [history, range])

  const perf = useMemo(() => aggregatePerformance(filtered), [filtered])

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <PageHeader
        title="Performance"
        sub={`${perf.total} signals tracked`}
        right={
          <div className="flex items-center gap-1 px-1 py-1 rounded-md glass">
            {RANGES.map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`h-7 px-3 rounded-[5px] text-[11px] font-medium num transition
                  ${range === r ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
                {r}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 min-h-0">
        {/* KPI row */}
        <div className="grid grid-cols-5 gap-3">
          <StatCard label="Win Rate"
            value={`${(perf.winRate * 100).toFixed(1)}%`}
            sub={`${perf.wins} W / ${perf.losses} L`}
            accent={perf.winRate >= 0.55 ? "#00ff88" : "#ffb800"} />
          <StatCard label="Total R"
            value={`${perf.totalR >= 0 ? "+" : ""}${perf.totalR.toFixed(1)}R`}
            sub="Cumulative"
            accent={perf.totalR >= 0 ? "#00ff88" : "#ff3d5a"} />
          <StatCard label="Profit Factor"
            value={perf.profitFactor.toFixed(2)}
            sub="Gross W / Gross L"
            accent={perf.profitFactor >= 1.5 ? "#00ff88" : "#ffb800"} />
          <StatCard label="Expectancy"
            value={`${perf.expectancy >= 0 ? "+" : ""}${perf.expectancy.toFixed(2)}R`}
            sub="Per trade" />
          <StatCard label="Avg R:R"
            value={`1 : ${(perf.avgWin / Math.max(perf.avgLoss, 0.01)).toFixed(2)}`}
            sub="Win / Loss size"
            accent="#00d4ff" />
        </div>

        {/* Equity curve */}
        <div className="panel rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute">Equity Curve · R units</div>
            <div className="text-[10px] text-mute num">{perf.total} closed trades</div>
          </div>
          <EquityCurve data={perf.equity} />
        </div>

        {/* Splits */}
        <div className="grid grid-cols-2 gap-4">
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">By Strategy</div>
            <SplitBars rows={perf.bySkillset} />
          </div>
          <div className="panel rounded-lg p-4">
            <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-3">By Symbol</div>
            <SplitBars rows={perf.bySymbol.slice(0, 8)} />
          </div>
        </div>

        {/* R distribution */}
        <div className="panel rounded-lg p-4">
          <div className="text-[11px] tracking-[0.18em] uppercase text-mute mb-4">R Distribution</div>
          <RDistribution history={filtered} />
        </div>
      </div>
    </div>
  )
}
