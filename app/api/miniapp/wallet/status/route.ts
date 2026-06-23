import { getNetworkDisplay } from "@/lib/wallet/ton"
import { getMiniAppInitData, miniAppError } from "@/lib/miniapp/auth"
import { getUserWithOptionalActiveWalletByTgId } from "@/lib/bot/users"
import { validateTelegramInitData } from "@/lib/telegram/init-data"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const initData = validateTelegramInitData(getMiniAppInitData(req))
    const { user, wallet } = await getUserWithOptionalActiveWalletByTgId(initData.user.id)

    return Response.json({
      ok: true,
      telegram: initData.user,
      user: user ?? {
        tg_username: initData.user.username ?? null,
        default_recv_token: "USDT",
      },
      wallet,
      network: getNetworkDisplay(),
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}
