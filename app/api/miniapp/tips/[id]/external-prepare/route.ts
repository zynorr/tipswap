import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  externalPaymentSummary,
  prepareExternalPaymentForTip,
  tipSummary,
} from "@/lib/miniapp/external-tips"
import { getTipById } from "@/lib/bot/users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, wallet } = await requireMiniAppSession(req)
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const senderAddress = String(body.senderAddress ?? "")
    const tip = await getTipById(id)
    if (!tip) throw new Error("Tip quote not found.")

    const result = await prepareExternalPaymentForTip({
      tip,
      sender: user,
      senderWallet: wallet,
      senderAddress,
    })

    return Response.json({
      ok: true,
      type: "external",
      provider: result.provider,
      tip: tipSummary(result.tip),
      payment: externalPaymentSummary(result.payment),
      message: result.message,
      quote: result.quote,
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
