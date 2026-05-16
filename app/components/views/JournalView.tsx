"use client"
import { useState, useMemo } from "react"
import type { HistoryEntry } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"

interface Props {
  history: HistoryEntry[]
  onOpen?: (s: HistoryEntry) => void
  onUpdateNote?: (sym: string, time: number, notes: string) => void
}

const LIFECYCLE: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: "ACTIVE",    color: "#00d4ff" },
  TP1:       { label: "TP1 ✓",    color: "#00ff88" },
  TP2:       { label: "TP2 ✓",    color: "#00ff88" },
  SL:        { label: "SL ✗",     color: "#ff3d5a" },
  CLOSED:    { label: "CLOSED",   color: "#a78bfa" },
  CANCELLED: { label: "VOID",     color: "#5a6779" },
  EXPIRED:   { label: "EXPIRED",  color: "#f59e0b" },
}

function LifecycleBadge({ state }: { state: string }) {
  const cfg = LIFECYCLE[state] ?? { label: state, color: "#5a6779" }
  return (
    <span
      className="px-1.5 h-[18px] inline-flex items-center rounded-[3px] text-[9.5px] font-bold tracking-[0.14em] whitespace-nowrap"
      style={{ background: cfg.color + "22", color: cfg.color }}
    >
      {cfg.label}
    </span>
  )
}

function ConfidencePill({ v }: { v: number }) {
  const c = v >= 70 ? "#00ff88" : v >= 40 ? "#ffb800" : "#ff3d5a"
  return (
    <span
      className="px-1.5 h-[18px] inline-flex items-center rounded-[3px] text-[10px] font-bold"
      style={{ background: c + "22", color: c }}
    >
      {v}%
    </span>
  )
}

const FILTERS = [
  { k: "all",    label: "All" },
  { k: "active", label: "Active" },
  { k: "wins",   label: "Wins" },
  { k: "losses", label: "Losses" },
] as const

export default function JournalView({ history, onOpen, onUpdateNote }: Props) {
  const [filter, setFilter] = useState<typeof FILTERS[number]["k"]>("all")
  const [q, setQ] = useState("")
  const [sort, setSort] = useState<"time" | "conf" | "pnl">("time")

  const filtered = useMemo(() => {
    return history
      .filter(s => {
        if (filter === "active"  && s.state !== "ACTIVE") return false
        if (filter === "wins"    && !((s.pnl_r ?? 0) > 0)) return false
        if (filter === "losses"  && !((s.pnl_r ?? 0) < 0)) return false
        if (q && !s.sym.toLowerCase().includes(q.toLowerCase()) &&
            !s.skillset.toLowerCase().includes(q.toLowerCase())) return false
        return true
      })
      .sort((a, b) => {
        if (sort === "conf") return b.confidence - a.confidence
        if (sort === "pnl")  return (b.pnl_r ?? 0) - (a.pnl_r ?? 0)
        return b.time - a.time
      })
  }, [history, filter, q, sort])

  const wins   = history.filter(h => (h.pnl_r ?? 0) > 0).length
  const losses = history.filter(h => (h.pnl_r ?? 0) < 0).length
  const active = history.filter(h => h.state === "ACTIVE").length

  const downloadCSV = () => {
    const headers = ["Time","Pair","Side","TF","Strategy","Entry","SL","TP1","TP2","Confidence","RR","State","PnL_R","Notes"]
    const esc = (v: string | number) => {
      const s = String(v)
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = filtered.map(s => [
      new Date(s.time).toISOString(),
      s.sym, s.side, s.tf, s.skillset,
      s.entry.toFixed(s.digits),
      s.sl.toFixed(s.digits),
      s.tp1.toFixed(s.digits),
      s.tp2.toFixed(s.digits),
      s.confidence,
      s.rr, s.state,
      s.pnl_r != null ? s.pnl_r.toFixed(2) : "",
      s.notes ?? "",
    ].map(esc).join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `tradeai-journal-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-end justify-between px-6 pt-5 pb-4 border-b hairline shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-accent-blue/10 text-accent-blue flex items-center justify-center">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4h12l4 4v12H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>
            </svg>
          </div>
          <div>
            <div className="text-[18px] font-semibold text-white tracking-tight">Signal Journal</div>
            <div className="text-[11px] text-mute mt-0.5">
              {history.length} signals · {active} active · {wins}W / {losses}L
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* export csv */}
          <button
            onClick={downloadCSV}
            className="h-9 px-3 rounded-md border border-white/10 text-[11px] text-white hover:bg-white/[0.04] transition flex items-center gap-1.5"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export CSV
          </button>
          {/* filter tabs */}
          <div className="flex items-center gap-1 px-1 py-1 rounded-md glass">
            {FILTERS.map(f => (
              <button key={f.k} onClick={() => setFilter(f.k)}
                className={`h-7 px-3 rounded-[5px] text-[11px] font-medium transition
                  ${filter === f.k ? "bg-white/[0.08] text-white" : "text-mute hover:text-white"}`}>
                {f.label}
              </button>
            ))}
          </div>
          {/* sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="h-9 px-3 rounded-md glass bg-transparent text-[11px] text-white outline-none border border-white/[0.06] cursor-pointer"
          >
            <option value="time" className="bg-[#0a0e1a]">Sort: Time</option>
            <option value="conf" className="bg-[#0a0e1a]">Sort: Confidence</option>
            <option value="pnl"  className="bg-[#0a0e1a]">Sort: P&L</option>
          </select>
          {/* search */}
          <div className="h-9 flex items-center gap-2 px-2.5 rounded-md glass border border-white/[0.06]">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-mute shrink-0">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Filter symbol / strategy…"
              className="bg-transparent outline-none text-[11.5px] placeholder:text-mute text-white w-[180px]"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-mute">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3">
              <path d="M4 4h12l4 4v12H4z"/><path d="M8 8h8M8 12h8M8 16h5"/>
            </svg>
            <div className="text-[13px]">No signals match the filter</div>
          </div>
        ) : (
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-ink-900 z-10">
              <tr className="text-[9.5px] tracking-[0.14em] uppercase text-mute border-b hairline">
                {["Time", "Pair", "Side", "TF", "Strategy", "Entry", "SL", "TP2", "Conf", "R:R", "State", "P&L", "Notes"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const pnl = s.pnl_r
                const pnlColor = pnl == null ? "#5a6779" : pnl > 0 ? "#00ff88" : "#ff3d5a"
                return (
                  <tr key={s.id ?? i}
                    onClick={() => onOpen?.(s)}
                    className="border-b border-white/[0.03] hover:bg-white/[0.025] transition cursor-pointer">
                    <td className="px-3 py-2.5 num text-mute whitespace-nowrap">
                      {new Date(s.time).toLocaleString(undefined, {
                        month: "short", day: "2-digit",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2.5 text-white font-semibold tracking-tight">{s.sym}</td>
                    <td className={`px-3 py-2.5 font-bold tracking-[0.12em] text-[10.5px]
                      ${s.side === "BUY" ? "text-accent-green" : "text-accent-red"}`}>
                      {s.side}
                    </td>
                    <td className="px-3 py-2.5 num text-mute">{s.tf}</td>
                    <td className="px-3 py-2.5 text-white/70 max-w-[130px] truncate">{s.skillset}</td>
                    <td className="px-3 py-2.5 num text-accent-blue/90">{fmt(s.entry, s.digits)}</td>
                    <td className="px-3 py-2.5 num text-accent-red/70">{fmt(s.sl, s.digits)}</td>
                    <td className="px-3 py-2.5 num text-accent-green/70">{fmt(s.tp2, s.digits)}</td>
                    <td className="px-3 py-2.5"><ConfidencePill v={s.confidence} /></td>
                    <td className="px-3 py-2.5 num text-mute">1:{s.rr}</td>
                    <td className="px-3 py-2.5"><LifecycleBadge state={s.state} /></td>
                    <td className="px-3 py-2.5 num font-semibold" style={{ color: pnlColor }}>
                      {pnl == null ? "—" : `${pnl > 0 ? "+" : ""}${pnl.toFixed(2)}R`}
                    </td>
                    <td className="px-3 py-2.5 min-w-[160px]" onClick={e => e.stopPropagation()}>
                      <input
                        type="text"
                        defaultValue={s.notes ?? ""}
                        onBlur={e => onUpdateNote?.(s.sym, s.time, e.currentTarget.value.trim())}
                        onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur() }}
                        placeholder="Add note…"
                        className="w-full bg-transparent outline-none text-[11px] text-white/70 placeholder:text-white/20 border-b border-transparent focus:border-white/15 transition pb-0.5"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer summary */}
      <div className="h-10 px-4 flex items-center justify-between border-t hairline shrink-0 text-[10.5px] text-mute">
        <span className="num">{filtered.length} of {history.length} entries</span>
        <div className="flex items-center gap-4 num">
          <span>Total R: <span className="text-white font-semibold">
            {history.filter(h=>h.pnl_r!=null).reduce((s,h)=>s+(h.pnl_r??0),0).toFixed(1)}R
          </span></span>
          <span>Win rate: <span className="text-white font-semibold">
            {history.length > 0
              ? `${((wins / Math.max(wins + losses, 1)) * 100).toFixed(0)}%`
              : "—"}
          </span></span>
        </div>
      </div>
    </div>
  )
}
