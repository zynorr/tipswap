import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  getExternalTipPaymentsByTipIds,
  getRecentSwapsForUser,
  getRecentTipClaimsForUser,
  getRecentTipsForUser,
  type TgExternalTipPayment,
  type TgSwap,
  type TgTip,
  type TgTipClaim,
} from "@/lib/bot/users"
import { claimSummary, tipSummary } from "@/lib/bot/tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function externalSummary(payment?: TgExternalTipPayment) {
  if (!payment) return null
  return {
    id: payment.id,
    provider: payment.provider,
    status: payment.status,
    reference: payment.reference,
    txHash: payment.tx_hash,
    traceId: payment.trace_id,
    error: payment.error,
    updatedAt: payment.updated_at,
  }
}

function tipActivity(tip: TgTip, userId: string, payment?: TgExternalTipPayment) {
  const direction = tip.sender_user_id === userId ? "sent" : "received"
  return {
    id: `tip:${tip.id}`,
    kind: "tip" as const,
    direction,
    status: tip.status,
    title: direction === "sent" ? "Tip sent" : "Tip received",
    primaryAmount: `${tip.ask_amount} ${tip.ask_token}`,
    secondaryAmount: tip.quoted_offer_amount
      ? `${tip.quoted_offer_amount} ${tip.offer_token}`
      : null,
    route: tip.offer_token === tip.ask_token
      ? `${tip.offer_token} direct`
      : `${tip.offer_token} -> ${tip.ask_token}`,
    source: tip.source,
    recipientAddress: tip.recipient_address,
    txHash: payment?.tx_hash ?? tip.tx_hash,
    error: payment?.error ?? tip.error,
    createdAt: tip.created_at,
    updatedAt: tip.updated_at,
    expiresAt: tip.expires_at,
    externalPayment: externalSummary(payment),
  }
}

function swapActivity(swap: TgSwap) {
  return {
    id: `swap:${swap.id}`,
    kind: "swap" as const,
    direction: "sent" as const,
    status: swap.status,
    title: "Swap",
    primaryAmount: `${swap.offer_amount} ${swap.offer_token}`,
    secondaryAmount: swap.expected_out ? `${swap.expected_out} ${swap.ask_token}` : null,
    route: `${swap.offer_token} -> ${swap.ask_token}`,
    source: "command",
    recipientAddress: null,
    txHash: swap.tx_hash,
    error: swap.error,
    createdAt: swap.created_at,
    updatedAt: swap.updated_at,
    expiresAt: null,
    externalPayment: null,
  }
}

function claimActivity(claim: TgTipClaim) {
  return {
    id: `claim:${claim.id}`,
    kind: "claim" as const,
    direction: "sent" as const,
    status: claim.status,
    title: "Claim link",
    primaryAmount: `${claim.ask_amount} ${claim.ask_token}`,
    secondaryAmount: claim.offer_token === claim.ask_token ? null : `from ${claim.offer_token}`,
    route: `@${claim.target_username}`,
    source: "claim",
    recipientAddress: null,
    txHash: null,
    error: claim.error,
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
    expiresAt: claim.expires_at,
    externalPayment: null,
    miniAppLink: claimSummary(claim).miniAppLink,
  }
}

export async function GET(req: Request) {
  try {
    const { user } = await requireMiniAppSession(req)
    const [tips, swaps, claims] = await Promise.all([
      getRecentTipsForUser(user.id, 10),
      getRecentSwapsForUser(user.id, 8),
      getRecentTipClaimsForUser(user.id, 8),
    ])
    const payments = await getExternalTipPaymentsByTipIds(tips.map((tip) => tip.id))
    const paymentsByTip = new Map(payments.map((payment) => [payment.tip_id, payment]))
    const activity = [
      ...tips.map((tip) => tipActivity(tip, user.id, paymentsByTip.get(tip.id))),
      ...swaps.map(swapActivity),
      ...claims.map(claimActivity),
    ]
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 20)

    return Response.json({
      ok: true,
      tips: tips.map(tipSummary),
      swaps,
      claims: claims.map(claimSummary),
      activity,
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}
