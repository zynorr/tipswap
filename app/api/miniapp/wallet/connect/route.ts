import { Address } from "@ton/core"
import { connectExternalWallet, getOrCreateUserProfile } from "@/lib/bot/users"
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
    const body = await req.json().catch(() => ({}))
    const rawAddress = String(body.address ?? "")
    if (!rawAddress.trim()) {
      throw new Error("Wallet address is required.")
    }
    let address: string
    try {
      address = Address.parse(rawAddress).toString({
        bounceable: false,
        testOnly: false,
      })
    } catch {
      throw new Error("Wallet address is not a valid TON address.")
    }
    const wallet = await connectExternalWallet(user.id, address)
    return Response.json({ ok: true, wallet })
  } catch (err) {
    return miniAppError(err, 400)
  }
}
