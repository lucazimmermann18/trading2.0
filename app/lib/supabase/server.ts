import { createClient } from "@supabase/supabase-js"

/**
 * Server-side Supabase client — uses the SERVICE_ROLE_KEY.
 * Never import this in client components — server-only!
 */
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "Supabase env vars fehlen. Setze NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  })
}
