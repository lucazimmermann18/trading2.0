"use client"
import { useEffect, useRef } from "react"
import type { Pair, HistoryEntry } from "@/app/lib/types"

type TerminalState = "TP1" | "TP2" | "SL" | "EXPIRED"

export interface ResolvedSignal {
  entry: HistoryEntry
  newState: TerminalState
  pnl_r: number
}

interface Props {
  pairs: Pair[]
  history: HistoryEntry[]
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>
  setPairs:   React.Dispatch<React.SetStateAction<Pair[]>>
  onResolve?: (r: ResolvedSignal) => void
}

export function useSignalLifecycle({ pairs, history, setHistory, setPairs, onResolve }: Props) {
  const resolvedRef   = useRef<Map<number | string, TerminalState>>(new Map())
  const onResolveRef  = useRef(onResolve)
  const historyRef    = useRef(history)
  const pairsRef      = useRef(pairs)
  onResolveRef.current = onResolve
  historyRef.current   = history
  pairsRef.current     = pairs

  // Core check — runs on every price tick AND on the 30s interval
  const check = (currentPairs: Pair[], currentHistory: HistoryEntry[]) => {
    const watched = currentHistory.filter(h => h.state === "ACTIVE" || h.state === "TP1")
    if (watched.length === 0) return

    const now = Date.now()
    const updates: { key: number | string; newState: TerminalState; pnl_r: number; sym: string; time: number }[] = []

    for (const sig of watched) {
      const pair   = currentPairs.find(p => p.sym === sig.sym)
      if (!pair) continue

      const price  = pair.px
      const key    = sig.id ?? sig.time
      const slDist = Math.abs(sig.entry - sig.sl)
      if (slDist === 0) continue

      const already = resolvedRef.current.get(key)

      // ── Expiry check (highest priority) ──────────────────────
      if (sig.expiresAt && now > sig.expiresAt && sig.state === "ACTIVE" && !already) {
        updates.push({ key, newState: "EXPIRED", pnl_r: 0, sym: sig.sym, time: sig.time })
        continue
      }

      // ── TP / SL checks ────────────────────────────────────────
      const tp1R = Math.abs(sig.side === "BUY" ? sig.tp1 - sig.entry : sig.entry - sig.tp1) / slDist
      const tp2R = Math.max(parseFloat(sig.rr) || 2.0, 0.5)

      if (sig.side === "BUY") {
        if (price <= sig.sl && already !== "SL")
          updates.push({ key, newState: "SL",  pnl_r: -1.0,  sym: sig.sym, time: sig.time })
        else if (price >= sig.tp2 && already !== "TP2" && already !== "SL")
          updates.push({ key, newState: "TP2", pnl_r: tp2R,  sym: sig.sym, time: sig.time })
        else if (price >= sig.tp1 && sig.state === "ACTIVE" && !already)
          updates.push({ key, newState: "TP1", pnl_r: tp1R,  sym: sig.sym, time: sig.time })
      } else {
        if (price >= sig.sl && already !== "SL")
          updates.push({ key, newState: "SL",  pnl_r: -1.0,  sym: sig.sym, time: sig.time })
        else if (price <= sig.tp2 && already !== "TP2" && already !== "SL")
          updates.push({ key, newState: "TP2", pnl_r: tp2R,  sym: sig.sym, time: sig.time })
        else if (price <= sig.tp1 && sig.state === "ACTIVE" && !already)
          updates.push({ key, newState: "TP1", pnl_r: tp1R,  sym: sig.sym, time: sig.time })
      }
    }

    if (updates.length === 0) return

    for (const u of updates) resolvedRef.current.set(u.key, u.newState)

    setHistory(prev => prev.map(h => {
      const upd = updates.find(u => u.key === (h.id ?? h.time))
      if (!upd) return h
      return { ...h, state: upd.newState, pnl_r: upd.newState === "EXPIRED" ? undefined : upd.pnl_r }
    }))

    // Clear pair signal for terminal states (TP2, SL, EXPIRED)
    const terminal = updates.filter(u => u.newState === "TP2" || u.newState === "SL" || u.newState === "EXPIRED")
    if (terminal.length > 0) {
      setPairs(prev => prev.map(p => {
        const hit = terminal.find(u => u.sym === p.sym && p.signal && Math.abs(p.signal.time - u.time) < 10000)
        if (!hit) return p
        return { ...p, status: "NO TRADE" as const, signal: null }
      }))
    }

    if (onResolveRef.current) {
      for (const upd of updates) {
        const entry = currentHistory.find(h => (h.id ?? h.time) === upd.key)
        if (entry) onResolveRef.current({ entry, newState: upd.newState, pnl_r: upd.pnl_r })
      }
    }
  }

  // Run on every price update
  useEffect(() => {
    if (pairs.length === 0) return
    check(pairs, history)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs])

  // Also run on a 30-second timer to catch expiry when prices are flat
  useEffect(() => {
    const id = setInterval(() => {
      check(pairsRef.current, historyRef.current)
    }, 30_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
