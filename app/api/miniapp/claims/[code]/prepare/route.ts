import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  claimSummary,
  prepareClaimForSenderConfirmation,
  tipSummary,
} from "@/lib/bot/tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const { user, wallet, initData } = await requireMiniAppSession(req)
    const { code } = await params
    const prepared = await prepareClaimForSenderConfirmation({
      code,
      recipient: user,
      recipientWallet: wallet,
      recipientTelegramUsername: initData.user.username ?? user.tg_username,
    })

    return Response.json({
      ok: true,
      alreadyPrepared: prepared.alreadyPrepared,
      claim: claimSummary(prepared.claim),
      tip: prepared.tip ? tipSummary(prepared.tip) : null,
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}

