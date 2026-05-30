import { getBalance, getJettonBalance } from "@/lib/wallet/ton"
import { TOKENS } from "@/lib/ston/swap"
import { miniAppError, requireMiniAppSession } from "@/lib/miniapp/auth"
import { fromNano } from "@ton/core"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function formatJetton(raw: bigint, decimals: number) {
  const div = 10n ** BigInt(decimals)
  const whole = raw / div
  const frac = (raw % div).toString().padStart(decimals, "0").slice(0, 4)
  return `${whole}.${frac}`
}

export async function GET(req: Request) {
  try {
    const { wallet } = await requireMiniAppSession(req)
    const [ton, usdt, ston] = await Promise.all([
      getBalance(wallet.address),
      getJettonBalance(wallet.address, TOKENS.USDT.mainnet),
      getJettonBalance(wallet.address, TOKENS.STON.mainnet),
    ])

    return Response.json({
      ok: true,
      wallet,
      balances: {
        TON: fromNano(ton),
        USDT: formatJetton(usdt, TOKENS.USDT.decimals),
        STON: formatJetton(ston, TOKENS.STON.decimals),
      },
    })
  } catch (err) {
    return miniAppError(err, 401)
  }
}

