"use client"
import { useMemo } from "react"

const SCHEDULE_KEY = "tradeai_schedule_v1"

const SESSION_DEFS = [
  { key: "tokyo",  open: 23, close: 8  },
  { key: "london", open: 8,  close: 17 },
  { key: "ny",     open: 13, close: 22 },
  { key: "sydney", open: 21, close: 6  },
]

function loadAllowedSessions(): string[] {
  if (typeof window === "undefined") return ["london", "ny"]
  try {
    const raw = localStorage.getItem(SCHEDULE_KEY)
    if (raw) return (JSON.parse(raw) as { active: string[] }).active
  } catch {}
  return ["london", "ny"]
}

function isHourInSession(h: number, open: number, close: number): boolean {
  if (open < close) return h >= open && h < close
  return h >= open || h < close  // wraps midnight
}

export interface SessionGateResult {
  allowed: boolean
  currentSessions: string[]   // sessions active right now by clock
  blockedSessions: string[]   // active-by-clock but NOT in user's allowed list
  allowedLabel: string        // e.g. "London, New York"
  reason: string              // shown in UI when blocked
}

export function useSessionGate(nowMs?: number): SessionGateResult {
  return useMemo(() => {
    const h = new Date(nowMs ?? Date.now()).getUTCHours()
    const allowed = loadAllowedSessions()

    const currentSessions = SESSION_DEFS
      .filter(s => isHourInSession(h, s.open, s.close))
      .map(s => s.key)

    const blockedSessions = currentSessions.filter(k => !allowed.includes(k))

    // Trading is allowed if at least one currently-active session is in the allowed list
    const hasActiveAllowed = currentSessions.some(k => allowed.includes(k))

    // Off-hours: no session active right now — only block if user has at least one session enabled
    const isOffHours = currentSessions.length === 0
    const tradingAllowed = isOffHours ? false : hasActiveAllowed

    const allowedLabel = SESSION_DEFS
      .filter(s => allowed.includes(s.key))
      .map(s => s.key.charAt(0).toUpperCase() + s.key.slice(1))
      .join(", ") || "None"

    let reason = ""
    if (isOffHours) {
      reason = "Off-hours — no major session active"
    } else if (!tradingAllowed) {
      const names = currentSessions.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(", ")
      reason = `${names} session — trading disabled in settings`
    }

    return {
      allowed: tradingAllowed,
      currentSessions,
      blockedSessions,
      allowedLabel,
      reason,
    }
  // recompute once per minute is fine; caller can pass in a clock value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Math.floor((nowMs ?? Date.now()) / 60_000)])
}
