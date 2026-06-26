import "server-only"

import {
  getOptionalActiveWallet,
  getOrCreateUserProfile,
  type TgUser,
  type TgWallet,
} from "@/lib/bot/users"
import {
  validateTelegramInitData,
  type ValidatedTelegramInitData,
} from "@/lib/telegram/init-data"

export type MiniAppSession = {
  initData: ValidatedTelegramInitData
  user: TgUser
  wallet: TgWallet
}

export function getMiniAppInitData(req: Request) {
  const header = req.headers.get("x-telegram-init-data")
  if (header) return header

  const auth = req.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("tma ")) return auth.slice(4).trim()
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim()

  return ""
}

export async function requireMiniAppSession(req: Request): Promise<MiniAppSession> {
  const initData = validateTelegramInitData(getMiniAppInitData(req))
  const { user } = await getOrCreateUserProfile({
    tgId: initData.user.id,
    tgUsername: initData.user.username ?? null,
    firstName: initData.user.first_name ?? null,
  })
  const wallet = await getOptionalActiveWallet(user.id)
  if (!wallet) {
    throw new Error("Choose a wallet before using this Mini App action.")
  }

  return { initData, user, wallet }
}

export function miniAppError(err: unknown, status = 400) {
  const message = (err as Error).message ?? String(err)
  const authExpired = message === "Telegram initData has expired"
  const authInvalid = message.startsWith("Telegram initData")
    || message.startsWith("Telegram auth_date")
    || message.startsWith("Telegram user")
  return Response.json({
    ok: false,
    error: message,
    code: authExpired ? "TELEGRAM_INIT_DATA_EXPIRED" : authInvalid ? "TELEGRAM_INIT_DATA_INVALID" : "MINIAPP_ERROR",
  }, { status: authInvalid ? 401 : status })
}
