import { verifySignature, type WebhookPayload } from "@ton-pay/api"
import { getExternalTipPaymentByReference } from "@/lib/bot/users"
import {
  applyTonPayTransferResult,
  externalPaymentSummary,
  tipSummary,
} from "@/lib/miniapp/external-tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-tonpay-signature") ?? ""
  const secret = process.env.TONPAY_WEBHOOK_SECRET

  if (!secret) {
    return Response.json({ ok: false, error: "TON Pay webhook secret is not configured." }, { status: 503 })
  }
  if (!signature || !verifySignature(rawBody, signature, secret)) {
    return Response.json({ ok: false, error: "Invalid signature." }, { status: 401 })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 })
  }

  if (payload.event !== "transfer.completed") {
    return Response.json({ ok: true, ignored: true })
  }

  const reference = payload.data.reference
  const payment = await getExternalTipPaymentByReference(reference)
  if (!payment) {
    return Response.json({ ok: true, unknownReference: true })
  }

  const result = await applyTonPayTransferResult(payment, payload.data)
  return Response.json({
    ok: true,
    payment: externalPaymentSummary(result.payment),
    tip: result.tip ? tipSummary(result.tip) : null,
  })
}
