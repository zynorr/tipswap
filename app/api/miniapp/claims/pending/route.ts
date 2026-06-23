import { claimSummary } from "@/lib/bot/tips"
import { miniAppError, getMiniAppInitData } from "@/lib/miniapp/auth"
import type { TgTipClaim } from "@/lib/bot/users"
import { adminClient } from "@/lib/supabase/admin"
import { validateTelegramInitData } from "@/lib/telegram/init-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const initData = validateTelegramInitData(getMiniAppInitData(req))
    const targetUsername = initData.user.username?.replace(/^@/, "").trim().toLowerCase()
    if (!targetUsername) {
      return Response.json({ ok: true, claims: [] })
    }

    const { data, error } = await adminClient()
      .from("tg_tip_claims")
      .select("*")
      .eq("target_username", targetUsername)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(5)

    if (error) throw error

    return Response.json({
      ok: true,
      claims: (data as unknown as TgTipClaim[]).map(claimSummary),
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}
