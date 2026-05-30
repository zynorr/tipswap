import { getNetworkDisplay } from "@/lib/wallet/ton"
import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const { user, wallet, initData } = await requireMiniAppSession(req)
    return Response.json({
      ok: true,
      telegram: initData.user,
      user,
      wallet,
      network: getNetworkDisplay(),
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}

