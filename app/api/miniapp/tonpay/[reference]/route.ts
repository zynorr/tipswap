import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  externalPaymentSummary,
  refreshTonPayTransfer,
  tipSummary,
} from "@/lib/miniapp/external-tips"
import { getExternalTipPaymentByReference, getTipById } from "@/lib/bot/users"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  try {
    await requireMiniAppSession(req)
    const { reference } = await params
    let result: Awaited<ReturnType<typeof refreshTonPayTransfer>>
    try {
      result = await refreshTonPayTransfer(reference)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!message.includes("Failed to get TON Pay transfer by reference")) {
        throw err
      }

      const payment = await getExternalTipPaymentByReference(reference)
      if (!payment) throw err
      const tip = await getTipById(payment.tip_id)

      return Response.json({
        ok: true,
        payment: externalPaymentSummary(payment),
        tip: tip ? tipSummary(tip) : null,
        transfer: {
          status: "pending",
          reference,
          txHash: payment.tx_hash ?? "",
          traceId: payment.trace_id ?? "",
          errorMessage: "TON Pay is still indexing this transfer.",
        },
      })
    }

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
