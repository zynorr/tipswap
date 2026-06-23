import { activateManagedWallet, getOrCreateUserProfile } from "@/lib/bot/users"
import { getMiniAppInitData, miniAppError } from "@/lib/miniapp/auth"
import { validateTelegramInitData } from "@/lib/telegram/init-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const initData = validateTelegramInitData(getMiniAppInitData(req))
    const { user } = await getOrCreateUserProfile({
      tgId: initData.user.id,
      tgUsername: initData.user.username ?? null,
      firstName: initData.user.first_name ?? null,
    })
    const wallet = await activateManagedWallet(user.id)
    return Response.json({ ok: true, wallet })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
