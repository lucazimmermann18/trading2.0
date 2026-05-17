"use client"
import { useState, useEffect, useCallback, useMemo } from "react"
import type { EconomicEvent } from "@/app/lib/types"

const CACHE_KEY = "tradeai_calendar_v1"
const CACHE_MS  = 4 * 60 * 60 * 1000 // 4h client-side cache

function loadCache(): EconomicEvent[] | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { data, at } = JSON.parse(raw) as { data: EconomicEvent[]; at: number }
    return Date.now() - at < CACHE_MS ? data : null
  } catch { return null }
}

function saveCache(data: EconomicEvent[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, at: Date.now() })) } catch {}
}

function eventTimestamp(e: EconomicEvent): number {
  // "2024-01-15" + "13:30:00" → UTC ms
  try { return new Date(`${e.date}T${e.time}Z`).getTime() } catch { return 0 }
}

export function useEconomicCalendar() {
  const [events, setEvents] = useState<EconomicEvent[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const cached = loadCache()
    if (cached) { setEvents(cached); return }
    setLoading(true)
    fetch("/api/calendar")
      .then(r => r.json())
      .then((data: EconomicEvent[]) => {
        const sorted = data.sort((a, b) => eventTimestamp(a) - eventTimestamp(b))
        setEvents(sorted)
        saveCache(sorted)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /** Returns blocking event if any of `currencies` has high-impact news within ±minuteRange min */
  const getBlockingEvent = useCallback((currencies: string[], minuteRange = 30): EconomicEvent | null => {
    const now = Date.now()
    for (const ev of events) {
      if (!currencies.some(c => c === ev.currency)) continue
      const evMs = eventTimestamp(ev)
      if (evMs && Math.abs(evMs - now) <= minuteRange * 60_000) return ev
    }
    return null
  }, [events])

  /** Events in the next 4 hours */
  const upcoming = useMemo(() =>
    events.filter(e => {
      const ms = eventTimestamp(e)
      return ms > Date.now() && ms - Date.now() < 4 * 3_600_000
    }),
  [events])

  /** Minutes until an event (negative = passed) */
  const minutesUntil = (e: EconomicEvent) =>
    Math.round((eventTimestamp(e) - Date.now()) / 60_000)

  return { events, loading, upcoming, getBlockingEvent, minutesUntil }
}
