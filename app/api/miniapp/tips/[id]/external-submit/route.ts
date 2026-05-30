import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  externalPaymentSummary,
  markExternalTipPaymentSubmitted,
  tipSummary,
} from "@/lib/miniapp/external-tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { initData } = await requireMiniAppSession(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const boc = String(body.boc ?? "")
    if (!boc) throw new Error("Signed transaction BOC is missing.")

    const result = await markExternalTipPaymentSubmitted({
      tipId: id,
      telegramUserId: initData.user.id,
      boc,
    })

    return Response.json({
      ok: true,
      tip: tipSummary(result.tip),
      payment: externalPaymentSummary(result.payment),
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
