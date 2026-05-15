"use client"
import { useEffect, useRef } from "react"
import type { Pair, HistoryEntry } from "@/app/lib/types"

type TerminalState = "TP1" | "TP2" | "SL"

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
  // Tracks the latest resolved state per signal (keyed by id ?? time)
  // so we never double-fire a transition
  const resolvedRef = useRef<Map<number | string, TerminalState>>(new Map())
  const onResolveRef = useRef(onResolve)
  onResolveRef.current = onResolve

  useEffect(() => {
    if (pairs.length === 0) return

    // Only watch ACTIVE and TP1 signals (TP2 / SL / CLOSED are terminal)
    const watched = history.filter(h => h.state === "ACTIVE" || h.state === "TP1")
    if (watched.length === 0) return

    const updates: { key: number | string; newState: TerminalState; pnl_r: number; sym: string; time: number }[] = []

    for (const sig of watched) {
      const pair = pairs.find(p => p.sym === sig.sym)
      if (!pair) continue

      const price  = pair.px
      const key    = sig.id ?? sig.time
      const slDist = Math.abs(sig.entry - sig.sl)
      if (slDist === 0) continue

      const already = resolvedRef.current.get(key)

      // Compute R multiples
      const tp1R = Math.abs(sig.side === "BUY" ? sig.tp1 - sig.entry : sig.entry - sig.tp1) / slDist
      const tp2R = Math.max(parseFloat(sig.rr) || 2.0, 0.5)

      if (sig.side === "BUY") {
        if (price <= sig.sl && already !== "SL") {
          updates.push({ key, newState: "SL", pnl_r: -1.0, sym: sig.sym, time: sig.time })
        } else if (price >= sig.tp2 && already !== "TP2" && already !== "SL") {
          updates.push({ key, newState: "TP2", pnl_r: tp2R, sym: sig.sym, time: sig.time })
        } else if (price >= sig.tp1 && sig.state === "ACTIVE" && !already) {
          updates.push({ key, newState: "TP1", pnl_r: tp1R, sym: sig.sym, time: sig.time })
        }
      } else {
        if (price >= sig.sl && already !== "SL") {
          updates.push({ key, newState: "SL", pnl_r: -1.0, sym: sig.sym, time: sig.time })
        } else if (price <= sig.tp2 && already !== "TP2" && already !== "SL") {
          updates.push({ key, newState: "TP2", pnl_r: tp2R, sym: sig.sym, time: sig.time })
        } else if (price <= sig.tp1 && sig.state === "ACTIVE" && !already) {
          updates.push({ key, newState: "TP1", pnl_r: tp1R, sym: sig.sym, time: sig.time })
        }
      }
    }

    if (updates.length === 0) return

    // Mark all resolved states immediately in the ref (sync, before React re-render)
    for (const u of updates) resolvedRef.current.set(u.key, u.newState)

    // Update history
    setHistory(prev => prev.map(h => {
      const upd = updates.find(u => u.key === (h.id ?? h.time))
      if (!upd) return h
      return { ...h, state: upd.newState, pnl_r: upd.pnl_r }
    }))

    // Clear pair signal for terminal states (TP2 / SL)
    const terminal = updates.filter(u => u.newState === "TP2" || u.newState === "SL")
    if (terminal.length > 0) {
      setPairs(prev => prev.map(p => {
        const hit = terminal.find(u => u.sym === p.sym && p.signal && Math.abs(p.signal.time - u.time) < 10000)
        if (!hit) return p
        return { ...p, status: "NO TRADE" as const, signal: null }
      }))
    }

    // Fire onResolve callbacks
    if (onResolveRef.current) {
      for (const upd of updates) {
        const entry = history.find(h => (h.id ?? h.time) === upd.key)
        if (entry) onResolveRef.current({ entry, newState: upd.newState, pnl_r: upd.pnl_r })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs]) // intentionally only react to price changes
}
