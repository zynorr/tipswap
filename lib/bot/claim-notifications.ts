import "server-only"

import type { TgTip, TgTipClaim, TgUser } from "@/lib/bot/users"
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
  alreadyPrepared: boolean
}) {
  const totalOffer = params.tip.quoted_offer_amount ?? params.tip.ask_amount
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
    "Confirm to send from your TipSwap managed wallet, or cancel this tip.",
    "Expires in 5 minutes.",
  ].join("\n")
}

export function claimConfirmationReplyMarkup(tipId: string) {
  return {
    inline_keyboard: [[
      { text: "Confirm", callback_data: `tip:confirm:${tipId}` },
      { text: "Cancel", callback_data: `tip:cancel:${tipId}` },
    ]],
  }
}

export async function notifyClaimSenderForConfirmation(params: {
  sender: TgUser
  claim: TgTipClaim
  tip: TgTip
  alreadyPrepared: boolean
}) {
  return sendTelegramMessage({
    chatId: params.sender.tg_id,
    text: claimConfirmationText(params),
    parseMode: "HTML",
    replyMarkup: claimConfirmationReplyMarkup(params.tip.id),
  })
}
