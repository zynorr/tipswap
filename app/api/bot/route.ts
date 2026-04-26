import { webhookCallback } from "grammy"
import { getBot } from "@/lib/bot"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  // Verify Telegram's secret token
  const secret = req.headers.get("x-telegram-bot-api-secret-token")
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 })
  }

  try {
    const handler = webhookCallback(getBot(), "std/http")
    return await handler(req)
  } catch (err) {
    console.error("[tipswap] webhook handler error:", err)
    // Telegram retries non-2xx forever — return 200 to acknowledge while we
    // log on our side. The bot.catch handler captures internal errors.
    return new Response("ok", { status: 200 })
  }
}

export async function GET() {
  return Response.json({ ok: true, bot: "tipswap" })
}
