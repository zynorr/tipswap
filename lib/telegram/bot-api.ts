import "server-only"

type InlineKeyboardButton = {
  text: string
  callback_data?: string
  url?: string
  web_app?: { url: string }
}

export async function sendTelegramMessage(params: {
  chatId: number
  text: string
  parseMode?: "HTML"
  replyMarkup?: { inline_keyboard: InlineKeyboardButton[][] }
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set")

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      ...(params.parseMode ? { parse_mode: params.parseMode } : {}),
      ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
    }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json.ok) {
    throw new Error(json.description ?? "Telegram sendMessage failed")
  }

  return json
}
