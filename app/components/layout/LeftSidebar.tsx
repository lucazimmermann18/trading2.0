"use client"
import { useState } from "react"
import type { Pair } from "@/app/lib/types"
import { fmt } from "@/app/lib/market-data"
import { type WatchedZone, zoneColor } from "@/app/lib/zones"
import { getCacheAgeMinutes } from "@/app/lib/bar-cache"

interface Props {
  pairs: Pair[]
  selectedId: number
  onSelect: (id: number) => void
  onToggleActive: (id: number) => void
  secondsLeft: number
  strategicSecsLeft: number
  scanning: boolean
  scannerOn: boolean
  zones: WatchedZone[]
  warmupDone: boolean
  barsReady: number
  totalActive: number
}

function TimerRing({
  seconds, max, color, size = 44,
}: { seconds: number; max: number; color: string; size?: number }) {
  const r = size / 2 - 4
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, (max - seconds) / max))
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0")
  const ss = String(seconds % 60).padStart(2, "0")
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[9px] num font-semibold" style={{ color }}>
        {mm}:{ss}
      </div>
    </div>
  )
}

function ScanTimer({
  secondsLeft, strategicSecsLeft, scanning, warmupDone, barsReady, totalActive, tacticalCount,
}: {
  secondsLeft: number; strategicSecsLeft: number; scanning: boolean
  warmupDone: boolean; barsReady: number; totalActive: number; tacticalCount: number
}) {
  const warmupPct = totalActive > 0 ? (barsReady / totalActive) * 100 : 0

  if (!warmupDone) {
    return (
      <div className="flex items-center gap-3 px-3 py-3 glass rounded-lg">
        <div className="relative w-12 h-12 shrink-0">
          <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
            <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
            <circle cx="25" cy="25" r="20" fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - warmupPct / 100)}`}
              className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-[10px] num text-amber-400 font-semibold">
            {barsReady}/{totalActive}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.16em] text-amber-400 uppercase">Loading Data</div>
          <div className="text-[12px] font-medium text-white">Warming up…</div>
          <div className="text-[10px] text-mute mt-0.5">{barsReady}/{totalActive} pairs ready</div>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-lg px-3 py-2.5 space-y-2">
      {/* Strategic scan row */}
      <div className="flex items-center gap-2.5">
        <TimerRing seconds={strategicSecsLeft} max={1800} color="#7c6dfa" size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Strategic</div>
          <div className="text-[11px] font-medium text-white leading-tight">
            {scanning ? "Scanning all pairs…" : `All pairs · 30 min`}
          </div>
        </div>
        {scanning && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse shrink-0" />}
      </div>

      {/* Tactical scan row */}
      <div className="flex items-center gap-2.5">
        <TimerRing seconds={secondsLeft} max={300} color="#00d4ff" size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[9px] tracking-[0.16em] text-mute uppercase">Tactical</div>
          <div className="text-[11px] font-medium text-white leading-tight">
            {tacticalCount > 0
              ? <span className="text-accent-blue">{tacticalCount} near zone</span>
              : "Watching zones · 5 min"}
          </div>
        </div>
        {tacticalCount > 0 && (
          <span className="px-1.5 h-4 rounded-full bg-accent-blue/20 text-accent-blue text-[9px] font-bold flex items-center shrink-0">
            {tacticalCount}
          </span>
        )}
      </div>
    </div>
  )
}

function PairRow({
  p, selected, onSelect, onToggle, pairZones,
}: {
  p: Pair; selected: boolean
  onSelect: () => void; onToggle: (e: React.MouseEvent) => void
  pairZones: WatchedZone[]
}) {
  const trade = p.status === "TRADE"
  const sigSide = p.signal?.side
  const cacheAge = getCacheAgeMinutes(p.sym)
  // Nearest zone to current price
  const nearest = pairZones.sort((a, b) => Math.abs(a.price - p.px) - Math.abs(b.price - p.px))[0]

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg px-3 py-2.5 cursor-pointer transition group
        ${selected ? "bg-white/[0.05] border-white/15" : "bg-white/[0.015] hover:bg-white/[0.035] border-white/[0.06]"}
        border ${trade ? "animate-tradePulse" : ""} ${!p.active ? "opacity-55" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-[12.5px] font-semibold tracking-tight text-white">{p.sym}</div>
          <span className="text-[9px] tracking-[0.16em] text-mute uppercase">{p.group}</span>
        </div>
        <button
          onClick={onToggle}
          className={`relative w-7 h-4 rounded-full transition ${p.active ? "bg-accent-blue/60" : "bg-white/10"}`}
        >
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${p.active ? "left-3.5" : "left-0.5"}`}/>
        </button>
      </div>

      <div className="mt-1.5 flex items-end justify-between">
        <div className="num text-[15px] font-semibold text-white tabular-nums leading-none">{fmt(p.px, p.digits)}</div>
        <div className="text-[10px] text-mute num">sp {p.spread.toFixed(p.spread < 1 ? 2 : 1)}</div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {p.active && p.history.length < 50 ? (
          <div className="flex items-center gap-1.5 px-2 h-5 rounded-[4px] text-[10px] tracking-[0.14em] bg-amber-500/10 text-amber-400 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"/>
            Loading…
          </div>
        ) : trade && sigSide ? (
          <>
            <div className={`flex items-center gap-1.5 px-2 h-5 rounded-[4px] text-[10px] font-bold tracking-[0.18em] whitespace-nowrap
              ${sigSide === "BUY" ? "bg-accent-green/20 text-accent-green" : "bg-accent-red/20 text-accent-red"}`}>
              ⚡ {sigSide}
            </div>
            <div className="text-[10px] num text-mute">conf {p.signal?.confidence}%</div>
          </>
        ) : p.scanPhase === "tactical" ? (
          <div className="flex items-center gap-1.5 px-2 h-5 rounded-[4px] text-[10px] font-bold tracking-[0.14em] bg-accent-blue/15 text-accent-blue whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-blue animate-pulse inline-block"/>
            ZONE ENTRY
          </div>
        ) : p.scanPhase === "watching" ? (
          <div
            className="flex items-center gap-1.5 px-2 h-5 rounded-[4px] text-[10px] font-semibold tracking-[0.14em] bg-violet-500/10 text-violet-400 whitespace-nowrap"
            title={p.watchZones?.map(z => `${z.direction} ${z.zoneBottom.toFixed(p.digits)}–${z.zoneTop.toFixed(p.digits)}`).join(" | ")}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 inline-block"/>
            WATCHING
          </div>
        ) : (
          <div className="px-2 h-5 rounded-[4px] text-[10px] font-bold tracking-[0.18em] bg-white/[0.04] text-mute flex items-center whitespace-nowrap">
            NO TRADE
          </div>
        )}
        {/* Cache freshness badge */}
        {cacheAge != null && cacheAge >= 60 && (
          <div
            className="flex items-center gap-1 px-1.5 h-5 rounded-[4px] text-[9px] whitespace-nowrap bg-white/[0.04] text-mute"
            title={`Data cached ${cacheAge}m ago`}
          >
            <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
            {cacheAge >= 60 ? `${Math.floor(cacheAge / 60)}h` : `${cacheAge}m`}
          </div>
        )}
        {/* Zone indicator */}
        {pairZones.length > 0 && nearest && (
          <div
            className="ml-auto flex items-center gap-1 px-1.5 h-5 rounded-[4px] text-[9px] font-semibold whitespace-nowrap"
            style={{ background: zoneColor(nearest.type) + "18", color: zoneColor(nearest.type) }}
            title={`${pairZones.length} zone${pairZones.length > 1 ? "s" : ""} — nearest: ${nearest.label}`}
          >
            <span className="w-1 h-1 rounded-full" style={{ background: zoneColor(nearest.type) }} />
            {pairZones.length}Z
          </div>
        )}
      </div>
    </div>
  )
}

export default function LeftSidebar({ pairs, selectedId, onSelect, onToggleActive, secondsLeft, strategicSecsLeft, scanning, scannerOn, zones, warmupDone, barsReady, totalActive }: Props) {
  const [search, setSearch] = useState("")
  const activeCount = pairs.filter(p => p.active).length
  const tradeCount = pairs.filter(p => p.status === "TRADE").length
  const watchingCount = pairs.filter(p => p.active && p.scanPhase === "watching").length
  const tacticalCount = pairs.filter(p => p.active && p.scanPhase === "tactical").length
  const filtered = pairs.filter(p =>
    p.sym.toLowerCase().includes(search.toLowerCase()) ||
    p.group.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <aside className="w-[260px] shrink-0 panel border-t-0 border-b-0 border-l-0 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-[0.18em] uppercase text-mute">Active Pairs</div>
          <div className="flex items-center gap-1.5 text-[10px] text-accent-green">
            <span className="dot bg-accent-green animate-pulseDot" style={{ boxShadow: "0 0 6px rgba(0,255,136,0.8)" }}/>
            LIVE
          </div>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <div className="text-[22px] num font-semibold text-white leading-none">{activeCount}</div>
          <div className="text-[10px] text-mute">/ {pairs.length} scanned</div>
          <div className="ml-auto flex items-center gap-1.5">
            {tradeCount > 0 && (
              <div className="text-[10px] num text-accent-green flex items-center gap-1">
                ⚡ {tradeCount}
              </div>
            )}
            {watchingCount > 0 && (
              <div className="text-[10px] num text-violet-400 flex items-center gap-1" title={`${watchingCount} pair${watchingCount > 1 ? "s" : ""} watching zones`}>
                👁 {watchingCount}
              </div>
            )}
            {tacticalCount > 0 && (
              <div className="text-[10px] num text-accent-blue flex items-center gap-1 animate-pulse" title={`${tacticalCount} pair${tacticalCount > 1 ? "s" : ""} near zone entry`}>
                ⚡ {tacticalCount}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3">
        <div className="h-8 flex items-center gap-2 px-2.5 rounded-md glass">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-mute shrink-0">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pairs…"
            className="bg-transparent flex-1 outline-none text-[12px] placeholder:text-mute text-white"
          />
        </div>
      </div>

      {/* Pair list */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1.5 pb-2">
        {filtered.map(p => (
          <PairRow
            key={p.id}
            p={p}
            selected={p.id === selectedId}
            onSelect={() => onSelect(p.id)}
            onToggle={e => { e.stopPropagation(); onToggleActive(p.id) }}
            pairZones={zones.filter(z => z.pairId === p.id)}
          />
        ))}
      </div>

      {/* Scanner timer */}
      <div className="p-3 border-t hairline">
        <ScanTimer
          secondsLeft={secondsLeft}
          strategicSecsLeft={strategicSecsLeft}
          scanning={scanning}
          warmupDone={warmupDone}
          barsReady={barsReady}
          totalActive={totalActive}
          tacticalCount={tacticalCount}
        />
        <div className="mt-2 flex items-center justify-between px-1">
          <div className="text-[10px] text-mute tracking-[0.12em] uppercase">AI Scanner</div>
          <div className={`text-[10px] font-bold tracking-[0.16em] ${scannerOn ? "text-accent-green" : "text-mute"}`}>
            {scannerOn ? "● ACTIVE" : "○ PAUSED"}
          </div>
        </div>
      </div>
    </aside>
  )
}
