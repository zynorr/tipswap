import { miniAppError, getMiniAppInitData } from "@/lib/miniapp/auth"
import { claimSummary, normalizeClaimCode, tipSummary } from "@/lib/bot/tips"
import { getTipById, getTipClaimByCode } from "@/lib/bot/users"
import { validateTelegramInitData } from "@/lib/telegram/init-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const initData = validateTelegramInitData(getMiniAppInitData(req))
    const { code: rawCode } = await params
    const code = normalizeClaimCode(rawCode)
    if (!code) throw new Error("That tip claim link is not valid.")

    const claim = await getTipClaimByCode(code)
    if (!claim) throw new Error("That tip claim link is not valid.")

    const currentUsername = initData.user.username?.replace(/^@/, "").trim().toLowerCase()
    if (!currentUsername || currentUsername !== claim.target_username) {
      throw new Error(`This claim link is for @${claim.target_username}.`)
    }

    const tip = claim.tip_id ? await getTipById(claim.tip_id) : null
    return Response.json({
      ok: true,
      claim: claimSummary(claim),
      tip: tip ? tipSummary(tip) : null,
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
