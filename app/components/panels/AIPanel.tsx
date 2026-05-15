"use client"
import type { Pair, KnowledgeModule, HistoryEntry } from "@/app/lib/types"
import { fmt, timeAgo, SKILLSETS } from "@/app/lib/market-data"
import { useState } from "react"

interface Props {
  pair: Pair
  skillset: string
  setSkillset: (s: string) => void
  knowledge: KnowledgeModule[]
  toggleKnowledge: (k: string) => void
  history: HistoryEntry[]
  threshold: number
  setThreshold: (n: number) => void
  scanning: boolean
  onScanPair: () => Promise<void>
}

function Section({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3.5 border-b hairline">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10px] tracking-[0.18em] uppercase text-mute">{label}</div>
        {sub && <div className="text-[10px] text-mute">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function KV({ label, v, color }: { label: string; v: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white/[0.025]">
      <span className="text-mute text-[10px] tracking-[0.14em]">{label}</span>
      <span className="num text-[11px]" style={{ color }}>{v}</span>
    </div>
  )
}

function SkillsetSelect({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full h-9 px-3 rounded-md glass flex items-center justify-between text-[12px]"
      >
        <span className="text-white">{value}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`text-mute transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 top-10 left-0 right-0 panel rounded-md p-1 shadow-2xl border border-white/[0.06]">
          {SKILLSETS.map(s => (
            <button
              key={s}
              onClick={() => { onChange(s); setOpen(false) }}
              className={`w-full text-left px-2.5 h-8 rounded text-[12px] flex items-center justify-between hover:bg-white/[0.05] transition
                ${s === value ? "text-accent-blue" : "text-white/85"}`}
            >
              <span>{s}</span>
              {s === value && (
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m5 12 5 5L20 7"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AIPanel({ pair, skillset, setSkillset, knowledge, toggleKnowledge, history, threshold, setThreshold, scanning, onScanPair }: Props) {
  const [manualScanning, setManualScanning] = useState(false)
  const trade = pair.status === "TRADE"
  const conf = pair.signal?.confidence ?? pair.confidence ?? 0
  const confCol = conf >= 70 ? "#00ff88" : conf >= 40 ? "#ffb800" : "#ff3d5a"
  const isScanning = scanning || manualScanning

  const handleManualScan = async () => {
    if (isScanning) return
    setManualScanning(true)
    try { await onScanPair() } finally { setManualScanning(false) }
  }

  return (
    <aside className="w-[320px] shrink-0 panel border-t-0 border-b-0 border-r-0 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b hairline shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-[0.18em] uppercase text-mute">AI Analysis Engine</div>
          <div className="flex items-center gap-1.5 text-[10px] text-accent-blue">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" className="animate-pulseDot">
              <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6 7.7 7.7M16.3 16.3l2.1 2.1M5.6 18.4 7.7 16.3M16.3 7.7l2.1-2.1"/>
            </svg>
            <span className="tracking-[0.14em]">CLAUDE</span>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="text-[14px] text-white font-medium tracking-tight">{pair.sym}</div>
          <span className={`px-1.5 h-4 rounded text-[9px] font-bold tracking-[0.16em] flex items-center
            ${trade ? "bg-accent-green/15 text-accent-green" : "bg-white/[0.04] text-mute"}`}>
            {trade ? "TRADE" : "NO TRADE"}
          </span>
        </div>
      </div>

      {/* Manual scan button */}
      <div className="px-4 py-3 border-b hairline shrink-0">
        <button
          onClick={handleManualScan}
          disabled={isScanning}
          className={`w-full h-9 rounded-md flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.18em] transition
            ${isScanning
              ? "bg-accent-blue/10 text-accent-blue/50 cursor-not-allowed"
              : "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/25 active:scale-[0.98]"}`}
          style={{ boxShadow: isScanning ? "none" : "inset 0 0 0 1px rgba(0,212,255,0.25)" }}
        >
          {isScanning ? (
            <>
              <svg className="animate-spin" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              ANALYSING…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35M11 8v6M8 11h6"/>
              </svg>
              ANALYSE NOW
            </>
          )}
        </button>
      </div>

      <div className="overflow-y-auto flex-1">
        {/* Skillset */}
        <Section label="Active Skillset">
          <SkillsetSelect value={skillset} onChange={setSkillset} />
        </Section>

        {/* Knowledge modules */}
        <Section label="Knowledge Modules" sub={`${knowledge.filter(k => k.on).length}/${knowledge.length} active`}>
          <div className="flex flex-wrap gap-1.5">
            {knowledge.map(k => (
              <button
                key={k.key}
                onClick={() => toggleKnowledge(k.key)}
                className={`text-[10.5px] px-2 h-7 rounded-full flex items-center gap-1.5 transition tracking-[0.02em]
                  ${k.on ? "chip-on" : "chip text-mute hover:text-white"}`}
              >
                <span className={`w-3 h-3 rounded-[3px] flex items-center justify-center ${k.on ? "bg-accent-blue/30 text-accent-blue" : "bg-white/5 text-transparent"}`}>
                  <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="m5 12 5 5L20 7"/>
                  </svg>
                </span>
                {k.label}
              </button>
            ))}
          </div>
        </Section>

        {/* Last AI scan */}
        <Section label="Last AI Scan" sub={timeAgo(pair.lastScan)}>
          <div className="rounded-lg p-3 bg-white/[0.025] border border-white/[0.06]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] tracking-[0.14em] text-mute">{pair.sym} · {pair.signal?.tf ?? "H1"}</div>
              <div className="text-[10px] num text-mute">{new Date(pair.lastScan).toLocaleTimeString()}</div>
            </div>
            <div className="text-[12px] leading-relaxed text-white/85">
              {trade ? pair.signal?.why : pair.reasoning}
            </div>
            {trade && pair.signal && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <KV label="Entry" v={fmt(pair.signal.entry, pair.digits)} color="#00d4ff"/>
                <KV label="SL"    v={fmt(pair.signal.sl,    pair.digits)} color="#ff3d5a"/>
                <KV label="TP1"   v={fmt(pair.signal.tp1,   pair.digits)} color="#00ff88"/>
                <KV label="TP2"   v={fmt(pair.signal.tp2,   pair.digits)} color="#00ff88"/>
              </div>
            )}
          </div>
        </Section>

        {/* Confidence */}
        <Section label="AI Confidence">
          <div className="flex items-baseline justify-between">
            <div className="text-[26px] num font-semibold" style={{ color: confCol }}>{conf}%</div>
            <div className="text-[10px] text-mute tracking-[0.14em] uppercase">
              {conf >= 70 ? "High" : conf >= 40 ? "Moderate" : "Low"}
            </div>
          </div>
          <div className="mt-2 relative h-2 bg-white/[0.05] rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-[40%] w-px bg-white/15"/>
            <div className="absolute inset-y-0 left-[70%] w-px bg-white/15"/>
            <div
              className="h-full transition-all duration-500"
              style={{ width: `${conf}%`, background: confCol, boxShadow: `0 0 10px ${confCol}` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-mute">
            <span>Signal threshold</span>
            <span className="num text-white">{threshold}%</span>
          </div>
          <input
            type="range" min="50" max="95"
            value={threshold}
            onChange={e => setThreshold(+e.target.value)}
            className="slider w-full mt-1.5"
          />
        </Section>

        {/* Signal log */}
        <Section label="Signal Log" sub={`${history.length} signals`}>
          <div className="space-y-1.5">
            {history.length === 0 && (
              <div className="text-[11px] text-mute italic px-1">No signals yet. AI is monitoring.</div>
            )}
            {history.slice(0, 8).map((s, i) => (
              <div key={i} className="px-2.5 py-2 rounded-md bg-white/[0.02] border border-white/[0.05] flex items-center gap-3">
                <span className={`dot ${s.side === "BUY" ? "bg-accent-green" : "bg-accent-red"}`}/>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[11.5px] font-semibold text-white tracking-tight">{s.sym}</div>
                    <div className={`text-[9.5px] font-bold tracking-[0.16em] ${s.side === "BUY" ? "text-accent-green" : "text-accent-red"}`}>
                      {s.side}
                    </div>
                    <div className="text-[9.5px] text-mute">{s.tf}</div>
                  </div>
                  <div className="text-[10px] text-mute num truncate">
                    {fmt(s.entry, s.digits)} · {s.confidence}% · {timeAgo(s.time)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  )
}
