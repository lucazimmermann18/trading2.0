"use server"
import { db } from "@/app/lib/supabase/server"
import type { HistoryEntry } from "@/app/lib/types"

export async function dbLoadHistory(): Promise<HistoryEntry[]> {
  try {
    const { data, error } = await db()
      .from("signal_history")
      .select("*")
      .order("time", { ascending: false })
    if (error) throw error
    return (data ?? []).map(rowToEntry)
  } catch (e) {
    console.error("dbLoadHistory:", e)
    return []
  }
}

export async function dbSaveHistory(entries: HistoryEntry[]): Promise<void> {
  if (!entries.length) return
  try {
    const { error } = await db()
      .from("signal_history")
      .upsert(entries.map(entryToRow), { onConflict: "id" })
    if (error) throw error
  } catch (e) {
    console.error("dbSaveHistory:", e)
  }
}

export async function dbPatchHistoryEntry(
  sym: string,
  time: number,
  patch: Partial<HistoryEntry>
): Promise<void> {
  try {
    const id = patch.id ?? `${sym}-${time}`
    const { error } = await db()
      .from("signal_history")
      .update({
        state:   patch.state,
        pnl_r:   patch.pnl_r,
        notes:   patch.notes,
        sl:      patch.sl,
      })
      .or(`id.eq.${id},and(sym.eq.${sym},time.eq.${time})`)
    if (error) throw error
  } catch (e) {
    console.error("dbPatchHistoryEntry:", e)
  }
}

// ── Row mappers ───────────────────────────────────────────────

function entryToRow(e: HistoryEntry) {
  return {
    id:          e.id ?? `${e.sym}-${e.time}`,
    sym:         e.sym,
    side:        e.side,
    tf:          e.tf,
    skillset:    e.skillset ?? "",
    entry:       e.entry,
    sl:          e.sl,
    tp1:         e.tp1,
    tp2:         e.tp2,
    digits:      e.digits,
    confidence:  e.confidence,
    rr:          e.rr,
    state:       e.state,
    pnl_r:       e.pnl_r ?? null,
    notes:       e.notes ?? null,
    why:         e.why ?? null,
    confluences: e.confluences ?? [],
    time:        e.time,
    expires_at:  e.expiresAt ?? null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToEntry(r: any): HistoryEntry {
  return {
    id:          r.id,
    sym:         r.sym,
    side:        r.side,
    tf:          r.tf,
    skillset:    r.skillset ?? "",
    entry:       r.entry,
    sl:          r.sl,
    tp1:         r.tp1,
    tp2:         r.tp2,
    digits:      r.digits,
    confidence:  r.confidence,
    rr:          r.rr,
    state:       r.state,
    pnl_r:       r.pnl_r ?? undefined,
    notes:       r.notes ?? undefined,
    why:         r.why ?? undefined,
    confluences: r.confluences ?? [],
    time:        r.time,
    expiresAt:   r.expires_at ?? undefined,
  }
}
