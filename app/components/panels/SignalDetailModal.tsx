"use client"
import { useRef } from "react"
import type { HistoryEntry } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"

interface Props {
  signal: HistoryEntry | null
  onClose: () => void
}

const LIFECYCLE_CFG: Record<string, { label: string; color: string; step: number }> = {
  ACTIVE:    { label: "Active",    color: "#00d4ff", step: 1 },
  TP1:       { label: "TP1 Hit",   color: "#00ff88", step: 3 },
  TP2:       { label: "TP2 Hit",   color: "#00ff88", step: 4 },
  SL:        { label: "Stopped",   color: "#ff3d5a", step: 2 },
  CLOSED:    { label: "Closed",    color: "#a78bfa", step: 4 },
  CANCELLED: { label: "Cancelled", color: "#5a6779", step: 0 },
}

const TIMELINE_STEPS = [
  { label: "Signal", icon: "⚡" },
  { label: "Entry",  icon: "→" },
  { label: "TP1",    icon: "✓" },
  { label: "TP2",    icon: "✓✓" },
]

function ConfidenceArc({ value }: { value: number }) {
  const r = 28, cx = 36, cy = 36
  const circ = 2 * Math.PI * r
  const arc = (value / 100) * circ * 0.75
  const col = value >= 70 ? "#00ff88" : value >= 40 ? "#ffb800" : "#ff3d5a"
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(135, 36, 36)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="5"
        strokeDasharray={`${arc} ${circ - arc}`}
        strokeDashoffset={circ * 0.125}
        strokeLinecap="round" transform="rotate(135, 36, 36)"
        style={{ filter: `drop-shadow(0 0 6px ${col}88)` }} />
      <text x="36" y="33" textAnchor="middle" fontSize="13" fontWeight="700"
        fontFamily="JetBrains Mono, monospace" fill={col}>{value}</text>
      <text x="36" y="46" textAnchor="middle" fontSize="8" fill="#5a6779"
        fontFamily="JetBrains Mono, monospace">CONF</text>
    </svg>
  )
}

function LevelCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex-1 rounded-lg p-3 border" style={{ borderColor: color + "30", background: color + "08" }}>
      <div className="text-[9px] tracking-[0.2em] uppercase mb-1.5" style={{ color: color + "99" }}>{label}</div>
      <div className="num text-[15px] font-semibold" style={{ color }}>{value}</div>
    </div>
  )
}

function RRBar({ rr }: { rr: string }) {
  const ratio = parseFloat(rr)
  const risk = 1
  const reward = ratio
  const total = risk + reward
  const riskPct = (risk / total) * 100
  return (
    <div>
      <div className="text-[9.5px] tracking-[0.16em] uppercase text-mute mb-1.5">Risk / Reward</div>
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        <div className="rounded-l-full" style={{ width: `${riskPct}%`, background: "#ff3d5a", opacity: 0.7 }} />
        <div className="flex-1 rounded-r-full" style={{ background: "#00ff88", opacity: 0.7 }} />
      </div>
      <div className="flex justify-between text-[9px] num text-mute mt-1">
        <span className="text-accent-red">−1R risk</span>
        <span className="text-accent-green font-semibold">+{rr}R reward</span>
      </div>
    </div>
  )
}

function Timeline({ state }: { state: string }) {
  const cfg = LIFECYCLE_CFG[state] ?? LIFECYCLE_CFG.ACTIVE
  const activeStep = cfg.step
  return (
    <div>
      <div className="text-[9.5px] tracking-[0.16em] uppercase text-mute mb-3">Signal Lifecycle</div>
      <div className="flex items-center">
        {TIMELINE_STEPS.map((step, i) => {
          const done = i < activeStep
          const current = i === activeStep - 1
          const isLast = i === TIMELINE_STEPS.length - 1
          const col = done ? (state === "SL" && i === 1 ? "#ff3d5a" : "#00ff88") : current ? cfg.color : "#2a3244"
          return (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] transition-all"
                  style={{
                    background: done || current ? col + "20" : "rgba(255,255,255,0.03)",
                    border: `1.5px solid ${done || current ? col : "#2a3244"}`,
                    color: done || current ? col : "#5a6779",
                    boxShadow: current ? `0 0 12px ${col}55` : "",
                  }}>
                  {step.icon}
                </div>
                <div className="text-[9px] text-mute whitespace-nowrap">{step.label}</div>
              </div>
              {!isLast && (
                <div className="flex-1 h-px mx-1 mb-4" style={{ background: i < activeStep - 1 ? "#00ff88" : "#2a3244" }} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SignalDetailModal({ signal, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)
  if (!signal) return null

  const cfg = LIFECYCLE_CFG[signal.state] ?? LIFECYCLE_CFG.ACTIVE
  const pnl = signal.pnl_r
  const pnlColor = pnl == null ? "#5a6779" : pnl > 0 ? "#00ff88" : "#ff3d5a"
  const sideColor = signal.side === "BUY" ? "#00ff88" : "#ff3d5a"

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-riseIn"
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="w-[820px] max-h-[88vh] panel rounded-xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="h-13 px-5 flex items-center justify-between border-b hairline shrink-0"
          style={{ borderBottomColor: sideColor + "30" }}>
          <div className="flex items-center gap-3">
            <div className="text-[18px] font-semibold text-white tracking-tight">{signal.sym}</div>
            <div className={`flex items-center gap-1.5 px-2.5 h-6 rounded-[5px] text-[10px] font-bold tracking-[0.2em]
              ${signal.side === "BUY" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"}`}>
              {signal.side === "BUY" ? "▲" : "▼"} {signal.side}
            </div>
            <div className="px-2 h-5 inline-flex items-center rounded-[3px] text-[9.5px] font-bold tracking-[0.14em]"
              style={{ background: cfg.color + "1f", color: cfg.color }}>
              {cfg.label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-[10.5px] text-mute num">
              {new Date(signal.time).toLocaleString(undefined, {
                month: "short", day: "2-digit",
                hour: "2-digit", minute: "2-digit",
              })}
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-md flex items-center justify-center text-mute hover:text-white hover:bg-white/[0.06] transition">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Top section: levels + confidence */}
          <div className="px-5 pt-5 pb-4 border-b hairline">
            <div className="flex items-start gap-5">
              {/* Confidence arc */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <ConfidenceArc value={signal.confidence} />
                <div className="text-[9px] text-mute tracking-[0.12em]">{signal.skillset}</div>
              </div>

              {/* Level cards */}
              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <LevelCard label="Entry"    value={fmt(signal.entry, signal.digits)} color="#00d4ff" />
                  <LevelCard label="Stop Loss" value={fmt(signal.sl,    signal.digits)} color="#ff3d5a" />
                  <LevelCard label="TP1"       value={fmt(signal.tp1,   signal.digits)} color="#00ff88" />
                  <LevelCard label="TP2"       value={fmt(signal.tp2,   signal.digits)} color="#00ff88" />
                </div>
                <div className="flex gap-4">
                  <RRBar rr={signal.rr} />
                  <div className="shrink-0 w-[120px]">
                    <div className="text-[9.5px] tracking-[0.16em] uppercase text-mute mb-1.5">P &amp; L</div>
                    <div className="num text-[20px] font-semibold leading-none" style={{ color: pnlColor }}>
                      {pnl == null ? "Open" : `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}R`}
                    </div>
                  </div>
                  <div className="shrink-0 w-[80px]">
                    <div className="text-[9.5px] tracking-[0.16em] uppercase text-mute mb-1.5">Timeframe</div>
                    <div className="num text-[20px] font-semibold text-white">{signal.tf}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="px-5 py-4 border-b hairline">
            <div className="text-[9.5px] tracking-[0.18em] uppercase text-mute mb-2 flex items-center gap-2">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2z"/>
                <path d="M12 18a2 2 0 0 1 2 2v0a2 2 0 0 1-4 0v0a2 2 0 0 1 2-2z"/>
                <path d="M4.93 4.93a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83L4.93 7.76a2 2 0 0 1 0-2.83z"/>
                <path d="M14.83 14.83a2 2 0 0 1 2.83 0l1.41 1.41a2 2 0 0 1-2.83 2.83l-1.41-1.41a2 2 0 0 1 0-2.83z"/>
                <path d="M2 12a2 2 0 0 1 2-2h2a2 2 0 0 1 0 4H4a2 2 0 0 1-2-2z"/>
                <path d="M18 12a2 2 0 0 1 2-2h0a2 2 0 0 1 0 4h0a2 2 0 0 1-2-2z"/>
              </svg>
              AI Analysis
            </div>
            <p className="text-[12.5px] text-white/80 leading-relaxed">{signal.why}</p>
          </div>

          {/* Lifecycle timeline */}
          <div className="px-5 py-4 border-b hairline">
            <Timeline state={signal.state} />
          </div>

          {/* Notes */}
          <div className="px-5 py-4">
            <div className="text-[9.5px] tracking-[0.18em] uppercase text-mute mb-2">Notes</div>
            <textarea
              defaultValue={signal.notes ?? ""}
              placeholder="Add notes about this trade…"
              rows={3}
              className="w-full bg-white/[0.025] border border-white/[0.06] rounded-md px-3 py-2 text-[12px] text-white outline-none focus:border-accent-blue/40 placeholder:text-mute/40 resize-none transition"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="h-12 px-5 flex items-center justify-between border-t hairline shrink-0">
          <div className="flex items-center gap-3 text-[10.5px] text-mute">
            <span>Strategy: <span className="text-white">{signal.skillset}</span></span>
            <span className="text-white/20">·</span>
            <span>TF: <span className="num text-white">{signal.tf}</span></span>
            <span className="text-white/20">·</span>
            <span>Confidence: <span className="num" style={{ color: signal.confidence >= 70 ? "#00ff88" : "#ffb800" }}>{signal.confidence}%</span></span>
          </div>
          <button onClick={onClose}
            className="h-8 px-4 rounded-md bg-accent-blue text-ink-950 text-[12px] font-semibold hover:bg-accent-blue/90 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
