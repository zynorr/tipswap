import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  claimSummary,
  prepareClaimForSenderConfirmation,
  tipSummary,
} from "@/lib/bot/tips"
import { notifyClaimSenderForConfirmation } from "@/lib/bot/claim-notifications"
import { getUserById } from "@/lib/bot/users"

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
    const tip = prepared.tip
    if (!tip) throw new Error("Tip confirmation quote could not be found.")

    const sender = "sender" in prepared
      ? prepared.sender
      : await getUserById(prepared.claim.sender_user_id)
    if (!sender) throw new Error("Tip sender could not be found.")

    try {
      await notifyClaimSenderForConfirmation({
        sender,
        claim: prepared.claim,
        tip,
        alreadyPrepared: prepared.alreadyPrepared,
      })
    } catch (err) {
      return miniAppError(
        new Error(`Claim is ready, but I could not notify the sender automatically: ${(err as Error).message}`),
        502,
      )
    }

    return Response.json({
      ok: true,
      alreadyPrepared: prepared.alreadyPrepared,
      claim: claimSummary(prepared.claim),
      tip: tipSummary(tip),
      senderNotified: true,
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
