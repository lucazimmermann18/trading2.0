"use client"
import { useCallback } from "react"
import type { Pair, TradeLesson } from "@/app/lib/types"
import type { ResolvedSignal } from "./useSignalLifecycle"
import { addLesson } from "@/app/lib/lessons-store"
import { dbAddLesson } from "@/app/lib/actions/lessons"

interface AISettings {
  activeProvider: "anthropic" | "openai" | "deepseek" | "gemini"
  selectedModels: Record<string, string>
  keyStatus: Record<string, boolean>
  useAI: boolean
}

interface Props {
  pairs: Pair[]
  aiSettings: AISettings
  onLesson?: (lesson: TradeLesson) => void
}

/**
 * Fire-and-forget AI review after a trade resolves.
 * Stores the lesson in localStorage and Supabase for future scans.
 */
export function useTradeReview({ pairs, aiSettings, onLesson }: Props) {
  const reviewTrade = useCallback(async (resolved: ResolvedSignal) => {
    if (!aiSettings.useAI || !aiSettings.keyStatus[aiSettings.activeProvider]) return
    // Only review terminal trades (not TP1 partial hits)
    if (resolved.newState !== "TP2" && resolved.newState !== "SL") return

    const { entry, newState, pnl_r } = resolved
    const pair = pairs.find(p => p.sym === entry.sym)
    if (!pair) return

    try {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiSettings.activeProvider,
          model: aiSettings.selectedModels[aiSettings.activeProvider],
          // apiKey intentionally omitted — fetched server-side from DB
          sym: entry.sym,
          digits: entry.digits,
          side: entry.side,
          outcome: newState,
          pnl_r,
          entry: entry.entry,
          sl: entry.sl,
          tp1: entry.tp1,
          tp2: entry.tp2,
          exitPrice: pair.px,
          signalTime: entry.time,
          reasoning: entry.why ?? "",
          confluences: (entry.confluences ?? []).filter(c => c.met).map(c => c.label),
          recentBars: pair.history.slice(-25),
          regime: pair.regime ?? "unknown",
          session: new Date().toUTCString(),
        }),
      })
      if (!res.ok) return

      const data = await res.json()
      if (!data.lesson) return

      const lesson: TradeLesson = {
        id: `${entry.sym}-${entry.time}`,
        sym: entry.sym,
        side: entry.side,
        outcome: newState as "TP2" | "SL",
        pnl_r,
        time: Date.now(),
        lesson: data.lesson,
        strengths: Array.isArray(data.strengths) ? data.strengths : [],
        mistakes: Array.isArray(data.mistakes) ? data.mistakes : [],
        nextTime: data.nextTime ?? "",
      }
      addLesson(lesson)
      void dbAddLesson(lesson)
      onLesson?.(lesson)
    } catch {
      // Non-critical — review failure never blocks trading
    }
  }, [pairs, aiSettings, onLesson])

  return { reviewTrade }
}
