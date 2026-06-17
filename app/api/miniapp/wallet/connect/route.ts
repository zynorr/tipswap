import { Address } from "@ton/core"
import { connectExternalWallet } from "@/lib/bot/users"
import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const { user } = await requireMiniAppSession(req)
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
