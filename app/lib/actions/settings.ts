"use server"
import { db } from "@/app/lib/supabase/server"

export interface DBSettings {
  skillset:        string
  threshold:       number
  timeframe:       string
  scanner_on:      boolean
  active_provider: string
  selected_models: Record<string, string>
  active_pair_ids: number[]
}

const DEFAULTS: DBSettings = {
  skillset:        "Smart Money Concepts",
  threshold:       82,
  timeframe:       "H1",
  scanner_on:      true,
  active_provider: "anthropic",
  selected_models: {},
  active_pair_ids: [],
}

export async function dbLoadSettings(): Promise<DBSettings> {
  try {
    const { data, error } = await db()
      .from("settings")
      .select("*")
      .eq("id", 1)
      .single()
    if (error) throw error
    return { ...DEFAULTS, ...data }
  } catch {
    return DEFAULTS
  }
}

export async function dbSaveSettings(patch: Partial<DBSettings>): Promise<void> {
  try {
    const { error } = await db()
      .from("settings")
      .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
    if (error) throw error
  } catch (e) {
    console.error("dbSaveSettings:", e)
  }
}
