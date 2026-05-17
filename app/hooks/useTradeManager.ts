"use client"
import { useEffect, useRef } from "react"
import type { Pair, HistoryEntry } from "@/app/lib/types"

interface Props {
  pairs: Pair[]
  history: HistoryEntry[]
  setPairs: React.Dispatch<React.SetStateAction<Pair[]>>
  setHistory: React.Dispatch<React.SetStateAction<HistoryEntry[]>>
  onBreakevenMove?: (sym: string, newSL: number) => void
}

/**
 * Active trade management:
 * - When TP1 is hit: move SL to breakeven (entry price)
 * - When price reaches halfway to TP2: trail SL to TP1 level
 * Updates BOTH pair.signal.sl AND the history entry sl so the lifecycle hook
 * respects the moved stop loss.
 */
export function useTradeManager({ pairs, history, setPairs, setHistory, onBreakevenMove }: Props) {
  const onMoveRef  = useRef(onBreakevenMove)
  const movedRef   = useRef<Set<string>>(new Set())
  onMoveRef.current = onBreakevenMove

  useEffect(() => {
    // Find signals that have already hit TP1 (partial)
    const tp1Entries = new Map(
      history
        .filter(h => h.state === "TP1")
        .map(h => [`${h.sym}:${h.time}`, h])
    )
    if (tp1Entries.size === 0) return

    const pairUpdates: Array<{ id: number; newSL: number }> = []
    const historyUpdates: Array<{ sym: string; time: number; newSL: number }> = []

    for (const p of pairs) {
      if (!p.signal) continue
      const key = `${p.sym}:${p.signal.time}`
      const histEntry = tp1Entries.get(key)
      if (!histEntry) continue
      if (movedRef.current.has(key)) continue  // already processed

      const { side, entry, sl, tp1, tp2 } = p.signal
      const price = p.px

      // Step 1: at minimum move SL to breakeven (entry)
      let newSL = side === "BUY"
        ? Math.max(sl, entry)
        : Math.min(sl, entry)

      // Step 2: trail — once price is 50% of the way from TP1 to TP2, trail SL to TP1
      if (side === "BUY") {
        const trailTrigger = tp1 + (tp2 - tp1) * 0.5
        if (price >= trailTrigger) newSL = Math.max(newSL, tp1)
      } else {
        const trailTrigger = tp1 - (tp1 - tp2) * 0.5
        if (price <= trailTrigger) newSL = Math.min(newSL, tp1)
      }

      if (Math.abs(newSL - sl) < 1e-8) continue  // no change
      pairUpdates.push({ id: p.id, newSL })
      historyUpdates.push({ sym: p.sym, time: p.signal.time, newSL })
    }

    if (pairUpdates.length === 0) return

    // Mark these keys so we don't re-process them on future ticks
    for (const u of historyUpdates) movedRef.current.add(`${u.sym}:${u.time}`)

    // Update pair signals
    setPairs(prev => prev.map(p => {
      const upd = pairUpdates.find(u => u.id === p.id)
      if (!upd || !p.signal) return p
      onMoveRef.current?.(p.sym, upd.newSL)
      return { ...p, signal: { ...p.signal, sl: upd.newSL } }
    }))

    // Sync SL to history so useSignalLifecycle uses the updated stop level
    setHistory(prev => prev.map(h => {
      const upd = historyUpdates.find(u => u.sym === h.sym && u.time === h.time)
      if (!upd) return h
      return { ...h, sl: upd.newSL }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs, history])
}
