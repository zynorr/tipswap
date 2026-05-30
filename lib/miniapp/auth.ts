import "server-only"

import {
  getOrCreateUser,
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
  const { user, wallet } = await getOrCreateUser({
    tgId: initData.user.id,
    tgUsername: initData.user.username ?? null,
    firstName: initData.user.first_name ?? null,
  })

  return { initData, user, wallet }
}

export function miniAppError(err: unknown, status = 400) {
  const message = (err as Error).message ?? String(err)
  return Response.json({ ok: false, error: message }, { status })
}

