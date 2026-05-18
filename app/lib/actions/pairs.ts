"use server"
import { db } from "@/app/lib/supabase/server"

export interface CustomPairDef {
  id:     number
  sym:    string
  name:   string
  group:  string
  digits: number
  spread: number
  active: boolean
}

export async function dbLoadCustomPairs(): Promise<CustomPairDef[]> {
  try {
    const { data, error } = await db()
      .from("custom_pairs")
      .select("*")
      .order("id", { ascending: true })
    if (error) throw error
    return (data ?? []).map(r => ({
      id:     r.id,
      sym:    r.sym,
      name:   r.name,
      group:  r.grp ?? "Custom",
      digits: r.digits,
      spread: r.spread,
      active: r.active,
    }))
  } catch {
    return []
  }
}

export async function dbSaveCustomPair(pair: CustomPairDef): Promise<void> {
  try {
    const { error } = await db().from("custom_pairs").upsert({
      id:     pair.id,
      sym:    pair.sym,
      name:   pair.name,
      grp:    pair.group,
      digits: pair.digits,
      spread: pair.spread,
      active: pair.active,
    })
    if (error) throw error
  } catch (e) {
    console.error("dbSaveCustomPair:", e)
  }
}

export async function dbDeleteCustomPair(id: number): Promise<void> {
  try {
    const { error } = await db().from("custom_pairs").delete().eq("id", id)
    if (error) throw error
  } catch (e) {
    console.error("dbDeleteCustomPair:", e)
  }
}
