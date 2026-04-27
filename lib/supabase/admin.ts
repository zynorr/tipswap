import { createClient } from "@supabase/supabase-js"

/**
 * Service-role Supabase client. Bypasses RLS.
 * Only ever import this from server-only code (bot, API routes).
 */
let _admin: ReturnType<typeof createClient> | null = null

export function adminClient() {
  if (_admin) return _admin

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY

  if (!url) throw new Error("SUPABASE_URL is not set")
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY) is not set",
    )
  }

  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return _admin
}
