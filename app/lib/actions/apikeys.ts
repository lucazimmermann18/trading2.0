"use server"
import { db } from "@/app/lib/supabase/server"

/**
 * Save an API key to the database.
 * Called from the SettingsModal — key is sent once and never returned to client.
 */
export async function dbSaveAPIKey(
  provider: string,
  apiKey: string,
  model: string
): Promise<void> {
  try {
    const { error } = await db()
      .from("api_keys")
      .upsert({ provider, api_key: apiKey, model, updated_at: new Date().toISOString() })
    if (error) throw error
  } catch (e) {
    console.error("dbSaveAPIKey:", e)
    throw e
  }
}

/**
 * Load all API keys — server-side only.
 * Returns { provider → { apiKey, model } }
 */
export async function dbLoadAPIKeys(): Promise<Record<string, { apiKey: string; model: string }>> {
  try {
    const { data, error } = await db().from("api_keys").select("provider, api_key, model")
    if (error) throw error
    const result: Record<string, { apiKey: string; model: string }> = {}
    for (const row of data ?? []) {
      result[row.provider] = { apiKey: row.api_key, model: row.model }
    }
    return result
  } catch {
    return {}
  }
}

/**
 * Check which providers have a saved key (returns boolean per provider, NOT the key).
 * Safe to call from client-side API routes that expose data to the browser.
 */
export async function dbGetAPIKeyStatus(): Promise<Record<string, boolean>> {
  try {
    const { data } = await db().from("api_keys").select("provider")
    const result: Record<string, boolean> = {}
    for (const row of data ?? []) {
      result[row.provider] = true
    }
    return result
  } catch {
    return {}
  }
}

/**
 * Get a single API key + model — server-side only, used by AI routes.
 */
export async function dbGetAPIKey(
  provider: string
): Promise<{ apiKey: string; model: string } | null> {
  try {
    const { data, error } = await db()
      .from("api_keys")
      .select("api_key, model")
      .eq("provider", provider)
      .single()
    if (error) return null
    return { apiKey: data.api_key, model: data.model }
  } catch {
    return null
  }
}
