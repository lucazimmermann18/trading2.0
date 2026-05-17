"use client"
import { useState, useEffect } from "react"
import type { EconomicEvent } from "@/app/lib/types"

const FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵",
  CHF: "🇨🇭", CAD: "🇨🇦", AUD: "🇦🇺", NZD: "🇳🇿",
  CNY: "🇨🇳", XAU: "🥇",
}

interface Props {
  upcoming: EconomicEvent[]
  minutesUntil: (e: EconomicEvent) => number
}

function EventPill({ ev, minsUntil }: { ev: EconomicEvent; minsUntil: number }) {
  const isImminent = Math.abs(minsUntil) <= 15
  const isPast = minsUntil < -5
  const flag = FLAG[ev.currency] ?? "🌐"

  const timeLabel = isPast
    ? `${Math.abs(minsUntil)}m ago`
    : minsUntil <= 0
    ? "NOW"
    : minsUntil < 60
    ? `in ${minsUntil}m`
    : `in ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md border whitespace-nowrap shrink-0 text-[10.5px] transition
        ${isPast
          ? "border-white/[0.06] bg-white/[0.02] text-mute opacity-50"
          : isImminent
          ? "border-accent-red/40 bg-accent-red/10 text-accent-red animate-pulse"
          : "border-amber-500/30 bg-amber-500/[0.08] text-amber-400"}`}
      title={`${ev.event} · ${ev.country} · ${ev.time} UTC`}
    >
      <span>{flag}</span>
      <span className="font-medium">{ev.currency}</span>
      <span className="text-white/60">·</span>
      <span className="truncate max-w-[140px]">{ev.event}</span>
      <span className={`font-bold tabular-nums ml-1 ${isPast ? "" : isImminent ? "text-accent-red" : "text-amber-300"}`}>
        {timeLabel}
      </span>
    </div>
  )
}

export default function CalendarStrip({ upcoming, minutesUntil }: Props) {
  const [tick, setTick] = useState(0)
  // Re-render every minute to update countdowns
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(i)
  }, [])
  void tick

  if (upcoming.length === 0) return null

  return (
    <div className="h-9 border-b border-amber-500/15 bg-amber-500/[0.03] flex items-center px-4 gap-2 overflow-x-auto shrink-0 scrollbar-none">
      <div className="flex items-center gap-1.5 shrink-0 text-[9.5px] tracking-[0.16em] uppercase text-amber-500/70 font-semibold">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        NEWSFLOW
      </div>
      <div className="w-px h-4 bg-white/[0.08] shrink-0" />
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
        {upcoming.map((ev, i) => (
          <EventPill key={i} ev={ev} minsUntil={minutesUntil(ev)} />
        ))}
      </div>
    </div>
  )
}
