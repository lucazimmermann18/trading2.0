"use client"
import { useMemo } from "react"
import type { Pair } from "@/app/lib/types"
import { buildCorrelationMatrix, fmt } from "@/app/lib/market-data"

interface Props {
  pairs: Pair[]
}

function PageHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
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
      <div className="flex items-center gap-1.5 text-[10px] text-accent-green">
        <span className="dot bg-accent-green animate-pulseDot" style={{ boxShadow: "0 0 6px rgba(0,255,136,0.8)" }} />
        LIVE
      </div>
    </div>
  )
}

function ConfidenceGrid({ pairs }: { pairs: Pair[] }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-mute mb-2.5">AI Confidence — All Pairs</div>
      <div className="grid grid-cols-7 gap-2">
        {pairs.map(p => {
          const c = p.signal?.confidence ?? p.confidence ?? 0
          const trade = p.status === "TRADE"
          const bg = c >= 70
            ? `rgba(0,255,136,${0.15 + c / 200})`
            : c >= 40
            ? `rgba(255,184,0,${0.10 + c / 300})`
            : `rgba(255,61,90,${0.08 + c / 400})`
          const textCol = c >= 70 ? "#00ff88" : c >= 40 ? "#ffb800" : "#ff3d5a"
          return (
            <div
              key={p.id}
              className="panel rounded-md p-2.5 relative overflow-hidden"
              style={{ background: bg }}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="text-[11px] font-semibold text-white tracking-tight leading-tight">{p.sym}</div>
                {trade && p.signal && (
                  <span className={`text-[8px] tracking-[0.14em] font-bold px-1 py-0.5 rounded-[3px] bg-black/30 shrink-0
                    ${p.signal.side === "BUY" ? "text-accent-green" : "text-accent-red"}`}>
                    {p.signal.side}
                  </span>
                )}
              </div>
              <div className="num text-[18px] font-semibold mt-1.5 leading-none" style={{ color: textCol }}>{c}%</div>
              <div className="text-[9px] text-white/50 num mt-1">{fmt(p.px, p.digits)}</div>
              {/* Thin bottom bar */}
              <div
                className="absolute bottom-0 left-0 h-[2px] rounded-b-md"
                style={{ width: `${c}%`, background: textCol, opacity: 0.8 }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MomentumBar({ pairs }: { pairs: Pair[] }) {
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-mute mb-2.5">RSI Momentum — Active Pairs</div>
      <div className="panel rounded-lg p-4 space-y-3">
        {pairs.filter(p => p.active).map(p => {
          const rsi = p.rsi ?? 50
          const col = rsi >= 70 ? "#ff3d5a" : rsi <= 30 ? "#00ff88" : "#00d4ff"
          const zone = rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral"
          return (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-[72px] text-[11px] font-medium text-white tracking-tight shrink-0">{p.sym}</div>
              <div className="flex-1 h-2 rounded-full bg-white/[0.05] relative overflow-hidden">
                {/* RSI track */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                  style={{ width: `${rsi}%`, background: col, opacity: 0.7 }}
                />
                {/* Overbought/oversold markers */}
                <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: "30%" }} />
                <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: "70%" }} />
              </div>
              <div className="num text-[11px] font-semibold w-10 text-right shrink-0" style={{ color: col }}>
                {rsi.toFixed(0)}
              </div>
              <div className="text-[9px] text-mute w-16 shrink-0">{zone}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CorrelationMatrix({ pairs }: { pairs: Pair[] }) {
  const corr = useMemo(() => buildCorrelationMatrix(pairs), [pairs])

  if (corr.length < 2) {
    return (
      <div>
        <div className="text-[10px] tracking-[0.2em] uppercase text-mute mb-2.5">Correlation Matrix · 30-bar</div>
        <div className="panel rounded-lg p-6 text-center text-mute text-[12px]">Enable at least 2 pairs to see correlation</div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-mute mb-2.5">Correlation Matrix · 30-bar</div>
      <div className="panel rounded-lg p-3 overflow-x-auto">
        <table className="num text-[10px] w-full border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-mute min-w-[72px]" />
              {corr.map(c => (
                <th key={c.sym} className="px-2 py-1.5 text-white font-medium tracking-tight text-center min-w-[56px]">
                  {c.sym.replace("/USD", "").replace("/", "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corr.map((row, i) => (
              <tr key={row.sym}>
                <td className="px-2 py-1.5 text-white font-medium tracking-tight whitespace-nowrap">
                  {row.sym.replace("/USD", "").replace("/", "")}
                </td>
                {row.row.map((v, j) => {
                  const isDiag = i === j
                  const bg = isDiag
                    ? "rgba(255,255,255,0.08)"
                    : v > 0
                    ? `rgba(0,255,136,${Math.abs(v) * 0.55})`
                    : `rgba(255,61,90,${Math.abs(v) * 0.55})`
                  const textCol = isDiag ? "#ffffff" : v > 0.6 ? "#00ff88" : v < -0.6 ? "#ff3d5a" : "#ffffff"
                  return (
                    <td
                      key={j}
                      className="px-2 py-1.5 text-center rounded-[3px] text-[10px] font-medium"
                      style={{ background: bg, color: textCol }}
                    >
                      {isDiag ? "—" : v.toFixed(2)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-3 text-[10px] text-mute">
          <span>−1.00 Strong negative</span>
          <div className="flex h-3 rounded overflow-hidden w-48 shrink-0">
            {Array.from({ length: 24 }).map((_, i) => {
              const v = (i - 12) / 12
              const bg = v > 0
                ? `rgba(0,255,136,${Math.abs(v) * 0.6})`
                : `rgba(255,61,90,${Math.abs(v) * 0.6})`
              return <div key={i} className="flex-1" style={{ background: bg }} />
            })}
          </div>
          <span>Strong positive +1.00</span>
        </div>
      </div>
    </div>
  )
}

function GroupSummary({ pairs }: { pairs: Pair[] }) {
  const groups = ["FX Major", "Metals", "Crypto", "Index", "Energy"]
  return (
    <div>
      <div className="text-[10px] tracking-[0.2em] uppercase text-mute mb-2.5">Signal Distribution by Group</div>
      <div className="grid grid-cols-5 gap-2">
        {groups.map(g => {
          const gPairs = pairs.filter(p => p.group === g)
          const active = gPairs.filter(p => p.active)
          const signals = active.filter(p => p.status === "TRADE")
          const buys = signals.filter(p => p.signal?.side === "BUY").length
          const sells = signals.filter(p => p.signal?.side === "SELL").length
          const avgConf = active.length
            ? Math.round(active.reduce((s, p) => s + (p.signal?.confidence ?? p.confidence ?? 0), 0) / active.length)
            : 0
          return (
            <div key={g} className="panel rounded-lg p-3">
              <div className="text-[10px] tracking-[0.14em] text-mute uppercase mb-2">{g}</div>
              <div className="text-[11px] text-white mb-1">
                <span className="num font-semibold">{signals.length}</span>
                <span className="text-mute"> / {active.length} signals</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] num mb-2">
                {buys > 0 && <span className="text-accent-green font-bold">▲ {buys}</span>}
                {sells > 0 && <span className="text-accent-red font-bold">▼ {sells}</span>}
                {buys === 0 && sells === 0 && <span className="text-mute">—</span>}
              </div>
              <div className="text-[10px] text-mute">
                Avg conf <span
                  className="num font-semibold"
                  style={{ color: avgConf >= 70 ? "#00ff88" : avgConf >= 40 ? "#ffb800" : "#ff3d5a" }}
                >{avgConf}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function HeatmapView({ pairs }: Props) {
  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <PageHeader
        icon={
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
        }
        title="Market Heatmap"
        sub="AI confidence, momentum, and cross-pair correlation at a glance"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
        <ConfidenceGrid pairs={pairs} />
        <GroupSummary pairs={pairs} />
        <MomentumBar pairs={pairs} />
        <CorrelationMatrix pairs={pairs} />
      </div>
    </div>
  )
}
