import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import {
  claimSummary,
  isAutoReceiveToken,
  prepareSingleRecipientTip,
  tipSummary,
} from "@/lib/bot/tips"
import {
  externalPaymentSummary,
  prepareExternalTipPayment,
} from "@/lib/miniapp/external-tips"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { user, wallet, initData } = await requireMiniAppSession(req)
    const body = await req.json().catch(() => ({}))
    const requestedAsk = String(body.ask ?? "AUTO")
    if (wallet.mode === "external") {
      const result = await prepareExternalTipPayment({
        sender: user,
        senderWallet: wallet,
        senderTelegramUsername: initData.user.username ?? user.tg_username,
        senderAddress: String(body.senderAddress ?? ""),
        recipientUsername: String(body.recipient ?? ""),
        amount: String(body.amount ?? ""),
        ask: requestedAsk,
        offer: String(body.offer ?? "TON"),
      })

      if (result.type === "claim") {
        return Response.json({ ok: true, type: "claim", claim: claimSummary(result.claim) })
      }

      return Response.json({
        ok: true,
        type: "external",
        provider: result.provider,
        tip: tipSummary(result.tip),
        payment: externalPaymentSummary(result.payment),
        message: result.message,
        recipient: {
          username: result.recipient.username,
          address: result.recipient.wallet.address,
          receiveToken: result.quote.askSymbol,
          usedPreference: isAutoReceiveToken(requestedAsk),
        },
        quote: result.quote,
      })
    }

    const result = await prepareSingleRecipientTip({
      sender: user,
      senderWallet: wallet,
      senderTelegramUsername: initData.user.username ?? user.tg_username,
      recipientUsername: String(body.recipient ?? ""),
      amount: String(body.amount ?? ""),
      ask: requestedAsk,
      offer: String(body.offer ?? "TON"),
    })

    if (result.type === "claim") {
      return Response.json({ ok: true, type: "claim", claim: claimSummary(result.claim) })
    }

    return Response.json({
      ok: true,
      type: "quote",
      tip: tipSummary(result.tip),
      recipient: {
        username: result.recipient.username,
        address: result.recipient.wallet.address,
        receiveToken: result.quote.askSymbol,
        usedPreference: isAutoReceiveToken(requestedAsk),
      },
      quote: {
        offerSymbol: result.quote.offerSymbol,
        askSymbol: result.quote.askSymbol,
        quotedOfferAmount: result.quote.quotedOfferAmount,
        expectedOut: result.quote.expectedOut,
        routerVersion: result.quote.routerVersion,
      },
    })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
