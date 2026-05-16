import type { HistoryEntry } from "./types"

const KEY = "tradeai_history_v2"
const MAX = 500

function read(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : []
  } catch {
    return []
  }
}

function write(entries: HistoryEntry[]) {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)))
  } catch {}
}

export function loadHistory(): HistoryEntry[] {
  return read()
}

export function saveHistory(entries: HistoryEntry[]) {
  write(entries)
}

/** Patch a single entry by sym+time — used when a signal resolves (TP/SL/EXPIRED) */
export function patchHistoryEntry(
  sym: string,
  time: number,
  patch: Partial<HistoryEntry>,
) {
  const entries = read()
  const idx = entries.findIndex(e => e.sym === sym && e.time === time)
  if (idx === -1) return
  entries[idx] = { ...entries[idx], ...patch }
  write(entries)
}
