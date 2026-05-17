"use client"
import { useEffect, useRef } from "react"
import type { Pair, HistoryEntry } from "@/app/lib/types"

interface Props {
  pairs: Pair[]
  history: HistoryEntry[]
  setPairs: React.Dispatch<React.SetStateAction<Pair[]>>
  onBreakevenMove?: (sym: string, newSL: number) => void
}

/**
 * Active trade management:
 * - When TP1 is hit: move SL to breakeven (entry price)
 * - When price reaches halfway to TP2: trail SL to TP1 level
 * Runs on every price update, modifies pair.signal.sl in-place.
 */
export function useTradeManager({ pairs, history, setPairs, onBreakevenMove }: Props) {
  const onMoveRef = useRef(onBreakevenMove)
  onMoveRef.current = onBreakevenMove

  useEffect(() => {
    // Find signals that have already hit TP1 (partial)
    const tp1Entries = new Set(
      history
        .filter(h => h.state === "TP1")
        .map(h => `${h.sym}:${h.time}`)
    )
    if (tp1Entries.size === 0) return

    let changed = false
    const updates: Array<{ id: number; newSL: number }> = []

    for (const p of pairs) {
      if (!p.signal) continue
      const key = `${p.sym}:${p.signal.time}`
      if (!tp1Entries.has(key)) continue

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

      if (newSL !== sl) {
        updates.push({ id: p.id, newSL })
        changed = true
      }
    }

    if (!changed) return

    setPairs(prev => prev.map(p => {
      const upd = updates.find(u => u.id === p.id)
      if (!upd || !p.signal) return p
      onMoveRef.current?.(p.sym, upd.newSL)
      return { ...p, signal: { ...p.signal, sl: upd.newSL } }
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairs])
}
