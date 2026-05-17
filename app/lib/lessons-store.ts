import type { TradeLesson } from "./types"

const KEY = "tradeai_lessons_v1"
const MAX  = 30

function load(): TradeLesson[] {
  if (typeof window === "undefined") return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") } catch { return [] }
}

function save(lessons: TradeLesson[]) {
  try { localStorage.setItem(KEY, JSON.stringify(lessons.slice(0, MAX))) } catch {}
}

export function addLesson(lesson: TradeLesson) {
  save([lesson, ...load()])
}

export function loadLessons(): TradeLesson[] {
  return load()
}

/** Returns up to `count` recent lessons — same-sym lessons first */
export function getRecentLessons(sym: string, count = 3): TradeLesson[] {
  const all = load()
  const forSym = all.filter(l => l.sym === sym).slice(0, 2)
  const other  = all.filter(l => l.sym !== sym).slice(0, count - forSym.length)
  return [...forSym, ...other].slice(0, count)
}
