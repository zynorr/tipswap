import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  externalPaymentSummary,
  refreshTonPayTransfer,
  tipSummary,
} from "@/lib/miniapp/external-tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    await requireMiniAppSession(req)
    const { reference } = await params
    const result = await refreshTonPayTransfer(reference)

    return Response.json({
      ok: true,
      payment: externalPaymentSummary(result.payment),
      tip: result.tip ? tipSummary(result.tip) : null,
      transfer: {
        status: result.transfer.status,
        reference: result.transfer.reference,
        txHash: result.transfer.txHash,
        traceId: result.transfer.traceId,
        errorMessage: result.transfer.errorMessage,
      },
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
