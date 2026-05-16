/**
 * @file Server-side Supabase admin client with service-role access.
 *
 * This client bypasses RLS and should NEVER be imported from client-side code.
 * It is used exclusively by:
 *   - Bot command handlers (lib/bot/users.ts)
 *   - Bot setup API (app/api/bot/setup/route.ts)
 *   - Waitlist API (app/api/waitlist/route.ts)
 *
 * Supports both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SECRET_KEY for
 * compatibility with different Supabase project configurations.
 * Falls back from SUPABASE_URL to NEXT_PUBLIC_SUPABASE_URL for the endpoint.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/types"

let _admin: SupabaseClient<Database> | null = null

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

  _admin = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return _admin
}
