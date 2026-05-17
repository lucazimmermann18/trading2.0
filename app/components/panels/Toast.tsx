"use client"
import { useEffect } from "react"
import type { Pair, Signal } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import type { ResolvedSignal } from "@/app/hooks/useSignalLifecycle"

/* ── Resolution Toast ──────────────────────────────────────── */

interface ResProps {
  resolved: ResolvedSignal | null
  onDismiss: () => void
}

export function ResolutionToast({ resolved, onDismiss }: ResProps) {
  useEffect(() => {
    if (!resolved) return
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [resolved, onDismiss])

  if (!resolved) return null

  const { entry, newState, pnl_r } = resolved
  const isWin  = newState === "TP1" || newState === "TP2"
  const color  = isWin ? "#00ff88" : "#ff3d5a"
  const icon   = isWin ? "✓" : "✗"
  const label  = newState === "TP1" ? "TP1 HIT — partial profit" : newState === "TP2" ? "TP2 HIT — full target" : "STOP LOSS HIT"
  const pnlStr = `${pnl_r > 0 ? "+" : ""}${pnl_r.toFixed(2)}R`

  return (
    <div
      className="toast-mobile panel rounded-xl p-4 animate-slideInRight"
      style={{ boxShadow: `0 0 0 1px ${color}55, 0 20px 50px -10px ${color}33` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] font-bold shrink-0"
          style={{ background: color + "20", color }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] tracking-[0.22em] uppercase" style={{ color }}>
            {label}
          </div>
          <div className="text-[15px] font-semibold text-white tracking-tight truncate">
            {entry.sym} · {entry.side}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[18px] font-bold num" style={{ color }}>{pnlStr}</div>
          <div className="text-[10px] text-mute">P&L</div>
        </div>
        <button onClick={onDismiss} className="text-mute hover:text-white transition ml-1">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <div className="mt-2.5 flex gap-3 text-[10.5px] text-mute num">
        <span>Entry <span className="text-white">{fmt(entry.entry, entry.digits)}</span></span>
        <span>SL <span className="text-white">{fmt(entry.sl, entry.digits)}</span></span>
        <span>Conf <span className="text-white">{entry.confidence}%</span></span>
      </div>
      {/* Auto-dismiss progress bar */}
      <div className="mt-2.5 h-[2px] rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full animate-[shrink_6s_linear_forwards]" style={{ background: color }} />
      </div>
    </div>
  )
}

interface Props {
  signal: Signal | null
  pair: Pair | null
  onDismiss: () => void
  onView: () => void
}

function KV({ label, v, color }: { label: string; v: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white/[0.025]">
      <span className="text-mute text-[10px] tracking-[0.14em]">{label}</span>
      <span className="num text-[11px]" style={{ color }}>{v}</span>
    </div>
  )
}

export default function Toast({ signal, pair, onDismiss, onView }: Props) {
  if (!signal || !pair) return null
  const isBuy = signal.side === "BUY"
  return (
    <div
      className="toast-mobile-lg panel rounded-xl p-4 animate-slideInRight"
      style={{
        boxShadow: isBuy
          ? "0 0 0 1px rgba(0,255,136,0.4), 0 24px 60px -10px rgba(0,255,136,0.25)"
          : "0 0 0 1px rgba(255,61,90,0.4), 0 24px 60px -10px rgba(255,61,90,0.25)",
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center ${isBuy ? "bg-accent-green/15 text-accent-green" : "bg-accent-red/15 text-accent-red"}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>
          </svg>
        </div>
        <div className="flex-1">
          <div className="text-[10px] tracking-[0.22em] text-accent-blue">TRADE SIGNAL DETECTED</div>
          <div className="text-[14px] font-semibold text-white tracking-tight">
            {pair.sym} · {signal.side} · {signal.tf}
          </div>
        </div>
        <button onClick={onDismiss} className="text-mute hover:text-white transition">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <KV label="Entry" v={fmt(signal.entry, pair.digits)} color="#00d4ff"/>
        <KV label="SL"    v={fmt(signal.sl,    pair.digits)} color="#ff3d5a"/>
        <KV label="TP1"   v={fmt(signal.tp1,   pair.digits)} color="#00ff88"/>
        <KV label="TP2"   v={fmt(signal.tp2,   pair.digits)} color="#00ff88"/>
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px]">
        <div className="text-mute">Confidence <span className="num text-white">{signal.confidence}%</span></div>
        <div className="text-mute">R:R <span className="num text-white">{signal.rr}</span></div>
        <div className="text-mute">{signal.skillset}</div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={onView}
          className="flex-1 h-8 rounded-md bg-accent-blue/15 text-accent-blue text-[11px] font-semibold tracking-[0.14em] hover:bg-accent-blue/25 transition"
        >
          VIEW CHART
        </button>
        <button
          onClick={onDismiss}
          className="flex-1 h-8 rounded-md btn-ghost text-[11px] font-semibold text-mute tracking-[0.14em] hover:text-white border border-white/[0.06]"
        >
          DISMISS
        </button>
      </div>
    </div>
  )
}
