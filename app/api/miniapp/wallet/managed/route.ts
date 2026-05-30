import { setActiveWallet } from "@/lib/bot/users"
import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { user } = await requireMiniAppSession(req)
    const wallet = await setActiveWallet(user.id, "managed")
    return Response.json({ ok: true, wallet })
  } catch (err) {
    return miniAppError(err, 400)
  }
}

