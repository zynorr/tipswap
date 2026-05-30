import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import { confirmSingleTip, tipSummary } from "@/lib/bot/tips"
import { getNetworkDisplay } from "@/lib/wallet/ton"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { initData } = await requireMiniAppSession(req)
    const { id } = await params
    const result = await confirmSingleTip({
      tipId: id,
      telegramUserId: initData.user.id,
    })

    return Response.json({
      ok: true,
      alreadySent: result.alreadySent,
      tip: tipSummary(result.tip),
      result: result.result
        ? {
            sent: result.result.sent,
            expectedOut: result.result.expectedOut,
            offerAmount: result.result.offerAmount,
            txHash: result.result.txHash,
            network: getNetworkDisplay(),
          }
        : null,
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}

