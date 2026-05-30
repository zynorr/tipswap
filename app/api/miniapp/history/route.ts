import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  getRecentSwapsForUser,
  getRecentTipClaimsForUser,
  getRecentTipsForUser,
} from "@/lib/bot/users"
import { claimSummary, tipSummary } from "@/lib/bot/tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { user } = await requireMiniAppSession(req)
    const [tips, swaps, claims] = await Promise.all([
      getRecentTipsForUser(user.id, 10),
      getRecentSwapsForUser(user.id, 8),
      getRecentTipClaimsForUser(user.id, 8),
    ])

    return Response.json({
      ok: true,
      tips: tips.map(tipSummary),
      swaps,
      claims: claims.map(claimSummary),
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}

