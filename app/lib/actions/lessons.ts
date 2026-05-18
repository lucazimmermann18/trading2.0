"use server"
import { db } from "@/app/lib/supabase/server"
import type { TradeLesson } from "@/app/lib/types"

export async function dbAddLesson(lesson: TradeLesson): Promise<void> {
  try {
    const { error } = await db().from("lessons").upsert({
      id:         lesson.id,
      sym:        lesson.sym,
      side:       lesson.side,
      outcome:    lesson.outcome,
      pnl_r:      lesson.pnl_r,
      lesson:     lesson.lesson,
      strengths:  lesson.strengths,
      mistakes:   lesson.mistakes,
      next_time:  lesson.nextTime,
      created_at: new Date(lesson.time).toISOString(),
    })
    if (error) throw error
  } catch (e) {
    console.error("dbAddLesson:", e)
  }
}

export async function dbGetRecentLessons(sym: string, limit = 3): Promise<TradeLesson[]> {
  try {
    const { data, error } = await db()
      .from("lessons")
      .select("*")
      .eq("sym", sym)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []).map(r => ({
      id:        r.id,
      sym:       r.sym,
      side:      r.side,
      outcome:   r.outcome,
      pnl_r:     r.pnl_r,
      time:      new Date(r.created_at).getTime(),
      lesson:    r.lesson,
      strengths: r.strengths ?? [],
      mistakes:  r.mistakes ?? [],
      nextTime:  r.next_time ?? "",
    }))
  } catch {
    return []
  }
}
