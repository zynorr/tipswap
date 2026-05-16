import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const TG_API = "https://api.telegram.org"

function isAuthorized(req: Request) {
  const adminToken = process.env.ADMIN_SETUP_TOKEN

  // Keep local development easy, but fail closed in production if the token
  // was not configured.
  if (!adminToken) return process.env.NODE_ENV !== "production"

  const auth = req.headers.get("authorization")
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null
  return bearer === adminToken || req.headers.get("x-admin-token") === adminToken
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
}

function token() {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN is not set")
  return t
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return unauthorized()

  try {
    const r = await fetch(`${TG_API}/bot${token()}/getWebhookInfo`, {
      cache: "no-store",
    })
    const data = await r.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized()

  let body: { action?: "set" | "delete"; url?: string } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action ?? "set"
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "TELEGRAM_WEBHOOK_SECRET is not set" },
      { status: 500 },
    )
  }

  try {
    if (action === "delete") {
      const r = await fetch(`${TG_API}/bot${token()}/deleteWebhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ drop_pending_updates: true }),
      })
      const data = await r.json()
      return NextResponse.json(data)
    }

    if (!body.url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 })
    }
    const url = body.url.replace(/\/$/, "") + "/api/bot"

    const r = await fetch(`${TG_API}/bot${token()}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    })
    const data = await r.json()
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}
