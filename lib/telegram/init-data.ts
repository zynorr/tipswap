import { createHmac, timingSafeEqual } from "node:crypto"

export type TelegramInitUser = {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
  is_premium?: boolean
  allows_write_to_pm?: boolean
}

export type ValidatedTelegramInitData = {
  user: TelegramInitUser
  authDate: Date
  queryId: string | null
  startParam: string | null
}

const DEFAULT_MAX_AGE_SECONDS = 24 * 60 * 60

function parseUser(value: string | null) {
  if (!value) throw new Error("Telegram user is missing")
  const parsed = JSON.parse(value) as TelegramInitUser
  if (!parsed || typeof parsed.id !== "number") {
    throw new Error("Telegram user is invalid")
  }
  return parsed
}

export function validateTelegramInitData(
  initData: string,
  botToken = process.env.TELEGRAM_BOT_TOKEN,
  maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS,
): ValidatedTelegramInitData {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  if (!initData) throw new Error("Telegram initData is missing")

  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) throw new Error("Telegram initData hash is missing")
  params.delete("hash")

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest()
  const calculated = createHmac("sha256", secret).update(dataCheckString).digest("hex")
  const expected = Buffer.from(hash, "hex")
  const actual = Buffer.from(calculated, "hex")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Telegram initData hash is invalid")
  }

  const authDateSeconds = Number(params.get("auth_date"))
  if (!Number.isFinite(authDateSeconds) || authDateSeconds <= 0) {
    throw new Error("Telegram auth_date is invalid")
  }
  if (Date.now() / 1000 - authDateSeconds > maxAgeSeconds) {
    throw new Error("Telegram initData has expired")
  }

  return {
    user: parseUser(params.get("user")),
    authDate: new Date(authDateSeconds * 1000),
    queryId: params.get("query_id"),
    startParam: params.get("start_param"),
  }
}

