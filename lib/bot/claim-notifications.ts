import "server-only"

import type { TgTip, TgTipClaim, TgUser, TgWallet } from "@/lib/bot/users"
import { miniAppTipSignLink } from "@/lib/bot/tips"
import { sendTelegramMessage } from "@/lib/telegram/bot-api"

function htmlEscape(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

function routeLabel(tip: TgTip) {
  return tip.offer_token === tip.ask_token || tip.slippage_bps === 0
    ? "direct transfer"
    : "STON.fi quote"
}

export function claimConfirmationText(params: {
  claim: TgTipClaim
  tip: TgTip
  senderWallet: TgWallet
  alreadyPrepared: boolean
}) {
  const totalOffer = params.tip.quoted_offer_amount ?? params.tip.ask_amount
  const isExternal = params.senderWallet.mode === "external"
  return [
    params.alreadyPrepared
      ? `<b>⏳ Tip claim still needs your confirmation</b>`
      : `<b>🎁 Tip claim ready</b>`,
    "",
    `@${htmlEscape(params.claim.target_username)} chose a receiving wallet.`,
    "",
    `Recipient receives: ≈ <b>${htmlEscape(params.tip.ask_amount)} ${htmlEscape(params.tip.ask_token)}</b>`,
    `You pay: ≈ <b>${htmlEscape(totalOffer)} ${htmlEscape(params.tip.offer_token)}</b>`,
    `Route: ${routeLabel(params.tip)}`,
    "",
    isExternal
      ? "Open the Mini App to sign from your connected wallet, or cancel this tip."
      : "Confirm to send from your TipSwap managed wallet, or cancel this tip.",
    "Expires in 5 minutes.",
  ].join("\n")
}

function miniAppTipSignUrl(tipId: string) {
  return miniAppTipSignLink(tipId)
}

export function claimConfirmationReplyMarkup(tipId: string, senderWallet: TgWallet) {
  const signUrl = senderWallet.mode === "external" ? miniAppTipSignUrl(tipId) : null
  return {
    inline_keyboard: signUrl
      ? [
          [{ text: "Open Mini App to sign", url: signUrl }],
          [{ text: "Cancel", callback_data: `tip:cancel:${tipId}` }],
        ]
      : [[
          { text: "Confirm", callback_data: `tip:confirm:${tipId}` },
          { text: "Cancel", callback_data: `tip:cancel:${tipId}` },
        ]],
  }
}

export async function notifyClaimSenderForConfirmation(params: {
  sender: TgUser
  claim: TgTipClaim
  tip: TgTip
  senderWallet: TgWallet
  alreadyPrepared: boolean
}) {
  return sendTelegramMessage({
    chatId: params.sender.tg_id,
    text: claimConfirmationText(params),
    parseMode: "HTML",
    replyMarkup: claimConfirmationReplyMarkup(params.tip.id, params.senderWallet),
  })
}
