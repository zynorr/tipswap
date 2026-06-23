import { getBalance, getJettonBalance } from "@/lib/wallet/ton"
import { TOKENS } from "@/lib/ston/swap"
import { getUserWithOptionalActiveWalletByTgId } from "@/lib/bot/users"
import { getMiniAppInitData, miniAppError } from "@/lib/miniapp/auth"
import { validateTelegramInitData } from "@/lib/telegram/init-data"
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
    const initData = validateTelegramInitData(getMiniAppInitData(req))
    const { wallet } = await getUserWithOptionalActiveWalletByTgId(initData.user.id)
    if (!wallet) {
      return Response.json({
        ok: true,
        wallet: null,
        balances: { TON: "0", USDT: "0", STON: "0" },
      })
    }
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
