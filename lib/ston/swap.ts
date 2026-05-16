/**
 * @file STON.fi DEX integration — swap construction, gas estimation, and on-chain quoting.
 *
 * Flow:
 *   1. Resolve token addresses (mainnet minter addresses)
 *   2. Preflight: check the wallet has enough TON for swap amount + gas + buffer
 *   3. Build the swap transaction via CPIRouterV2_2 (handles TON↔Jetton, Jetton→TON, Jetton→Jetton)
 *   4. Query the pool on-chain for a real-time expected output quote
 *   5. Broadcast and confirm (seqno polling)
 *
 * The CPIRouterV2_2 works with pTON v2.1 for native TON wrapping/unwrapping.
 * All swap paths use a single pool hop through the CPI router.
 */
import "server-only"
import { Address, toNano } from "@ton/core"
import { TonClient } from "@ton/ton"
import { pTON } from "@ston-fi/sdk"
import { CPIRouterV2_2 } from "@ston-fi/sdk/dex/v2_2"
import { getBalance, getTonClient, getNetwork, sendInternalMessage } from "@/lib/wallet/ton"


/**
 * STON.fi DEX v2.2 contract addresses.
 *
 * Mainnet addresses are official (https://docs.ston.fi).
 * STON.fi pools used by this bot are mainnet-only.
 */
const ADDRESSES = {
  mainnet: {
    router: "EQD11suHkrO_1Mb5IIdYFx5ZPy38MuHoeHx6dA-QRaD8w0UJ",
    pton: "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S",
  },
} as const

export class SwapUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SwapUserError"
  }
}

/** Common jetton minter addresses keyed by symbol. */
export const TOKENS: Record<string, { mainnet: string; decimals: number }> = {
  TON: { mainnet: "TON", decimals: 9 }, // sentinel — handled specially
  USDT: {
    mainnet: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    decimals: 6,
  },
  STON: {
    mainnet: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO",
    decimals: 9,
  },
}

export function resolveToken(symbol: string) {
  const upper = symbol.toUpperCase()
  const entry = TOKENS[upper]
  if (!entry) {
    throw new Error(
      `Unknown token: ${symbol}. Supported: ${Object.keys(TOKENS).join(", ")}`,
    )
  }
  return { symbol: upper, ...entry }
}

export type SwapParams = {
  /** Sender's wallet mnemonic (decrypted, in memory only) */
  mnemonic: string
  /** Sender's TON wallet address */
  userAddress: string
  /** Symbol or jetton minter address of the token being sold */
  offer: string
  /** Symbol or jetton minter address of the token being bought */
  ask: string
  /** Human-readable amount of the offer token (e.g. "0.5") */
  offerAmount: string
  /** Slippage in basis points. 100 = 1% */
  slippageBps?: number
  /** Optional minimum ask amount (raw units). If omitted we set 1n (no slippage protection). */
  minAskAmount?: bigint
}

export function toRawAmount(amount: string, decimals: number) {
  const [whole, frac = ""] = amount.split(".")
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(whole + padded)
}

export function requiredTonForSwap(offerSymbol: string, askSymbol: string, offerRaw: bigint) {
  // STON.fi recommended gas ranges (docs.ston.fi):
  //   TON → Jetton: 0.15–0.25 TON
  //   Jetton → TON: 0.15–0.25 TON
  //   Jetton → Jetton: 0.25–0.40 TON
  const isTonOffer = offerSymbol === "TON"
  const isTonAsk = askSymbol === "TON"
  const gas =
    isTonOffer || isTonAsk ? toNano("0.2") : toNano("0.3")
  const buffer = toNano("0.05")
  const offerPart = isTonOffer ? offerRaw : 0n
  return { offerPart, gas, buffer, total: offerPart + gas + buffer }
}

export function formatTon(amountNano: bigint) {
  const sign = amountNano < 0n ? "-" : ""
  const abs = amountNano < 0n ? -amountNano : amountNano
  const whole = abs / 1_000_000_000n
  const frac = (abs % 1_000_000_000n).toString().padStart(9, "0").slice(0, 4)
  return `${sign}${whole.toString()}.${frac}`
}

/**
 * Build and broadcast a STON.fi swap from the provided wallet.
 * Returns the seqno-confirmation result from sendInternalMessage.
 */
export async function executeSwap(params: SwapParams) {
  const network = getNetwork()
  const addrs = ADDRESSES[network]
  const client = getTonClient(network)

  const router = client.open(
    CPIRouterV2_2.create(Address.parse(addrs.router)),
  )
  const proxyTon = pTON.v2_1.create(Address.parse(addrs.pton))

  const offer = resolveToken(params.offer)
  const ask = resolveToken(params.ask)

  const offerRaw = toRawAmount(params.offerAmount, offer.decimals)
  const minAskAmount = params.minAskAmount ?? 1n // permissive default for M1; production should compute via quote

  // Preflight: for any swap we need TON for gas; for TON offers we need offer+gas.
  const tonBalance = await getBalance(params.userAddress)
  const cost = requiredTonForSwap(offer.symbol, ask.symbol, offerRaw)
  if (tonBalance < cost.total) {
    const lines = [
      `Insufficient TON balance. Need ${formatTon(cost.total)} TON, wallet has ${formatTon(tonBalance)} TON.`,
      "",
    ]
    if (offer.symbol === "TON") {
      lines.push(`Swap amount: ${formatTon(cost.offerPart)} TON`)
    }
    lines.push(`Gas (STON.fi): ${formatTon(cost.gas)} TON`)
    lines.push(`Safety buffer: ${formatTon(cost.buffer)} TON`)

    throw new SwapUserError(lines.join("\n"))
  }

  let txParams: { to: Address; value: bigint; body?: import("@ton/core").Cell | null }

  try {
    if (offer.symbol === "TON" && ask.symbol !== "TON") {
      txParams = await router.getSwapTonToJettonTxParams({
        userWalletAddress: params.userAddress,
        proxyTon,
        askJettonAddress: ask.mainnet,
        offerAmount: offerRaw,
        minAskAmount,
      })
    } else if (offer.symbol !== "TON" && ask.symbol === "TON") {
      txParams = await router.getSwapJettonToTonTxParams({
        userWalletAddress: params.userAddress,
        proxyTon,
        offerJettonAddress: offer.mainnet,
        offerAmount: offerRaw,
        minAskAmount,
      })
    } else if (offer.symbol !== "TON" && ask.symbol !== "TON") {
      txParams = await router.getSwapJettonToJettonTxParams({
        userWalletAddress: params.userAddress,
        offerJettonAddress: offer.mainnet,
        askJettonAddress: ask.mainnet,
        offerAmount: offerRaw,
        minAskAmount,
      })
    } else {
      throw new Error("Cannot swap a token to itself")
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (
      message.toLowerCase().includes("insufficient") ||
      message.toLowerCase().includes("not enough") ||
      message.toLowerCase().includes("low balance")
    ) {
      throw new SwapUserError(
        "Insufficient balance for this swap. Top up wallet and try a smaller amount.",
      )
    }
    if (message.includes("status code 500")) {
      throw new SwapUserError(
        "Swap route unavailable right now. Try TON/USDT or TON/STON, reduce amount, and retry in 20-30s.",
      )
    }
    throw err
  }

  // Get an on-chain quote (expected output) before sending
  let expectedOut: string | null = null
  try {
    expectedOut = await getExpectedOut({
      client,
      routerAddress: Address.parse(addrs.router),
      offerSymbol: offer.symbol,
      askSymbol: ask.symbol,
      offerRaw,
      askDecimals: ask.decimals,
      ptonAddress: Address.parse(addrs.pton),
    })
  } catch (e) {
    // Quote is best-effort — don't block the swap if it fails
    console.warn("[tipswap] quote lookup failed:", (e as Error).message)
  }

  const result = await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: txParams.to,
    value: txParams.value,
    body: txParams.body ?? undefined,
  })

  return {
    ...result,
    expectedOut,
    offerRaw: offerRaw.toString(),
    network,
  }
}

/**
 * Estimate gas-only TON cost for a swap (rough). Used for confirmation messages.
 */
export function estimateGasTon(offerSymbol: string, askSymbol: string) {
  const isTonOffer = offerSymbol.toUpperCase() === "TON"
  const isTonAsk = askSymbol.toUpperCase() === "TON"
  return isTonOffer || isTonAsk ? 0.2 : 0.3
}

export const SWAP_NETWORK = getNetwork

/**
 * Format a raw token amount with the given decimals into a human-readable string.
 */
export function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals)
  const whole = raw / divisor
  const frac = (raw % divisor).toString().padStart(decimals, "0").slice(0, 4)
  return `${whole}.${frac}`
}

/**
 * Query the STON.fi pool to estimate how much the user will receive from a swap.
 * Uses the pool's on-chain reserves and fee structure.
 */
export async function getExpectedOut(params: {
  client: TonClient
  routerAddress: Address
  offerSymbol: string
  askSymbol: string
  offerRaw: bigint
  askDecimals: number
  ptonAddress: Address
}): Promise<string> {
  const { client, routerAddress, offerSymbol, askSymbol, offerRaw, askDecimals, ptonAddress } = params

  const router = client.open(CPIRouterV2_2.create(routerAddress))

  // Determine pool tokens (always offer first, ask second)
  let token0: Address, token1: Address
  if (offerSymbol === "TON" && askSymbol !== "TON") {
    token0 = ptonAddress
    token1 = Address.parse(TOKENS[askSymbol].mainnet)
  } else if (offerSymbol !== "TON" && askSymbol === "TON") {
    token0 = Address.parse(TOKENS[offerSymbol].mainnet)
    token1 = ptonAddress
  } else if (offerSymbol !== "TON" && askSymbol !== "TON") {
    token0 = Address.parse(TOKENS[offerSymbol].mainnet)
    token1 = Address.parse(TOKENS[askSymbol].mainnet)
  } else {
    throw new Error("Cannot swap TON to TON")
  }

  const pool = await router.getPool({ token0, token1 })

  const provider = client.provider(pool.address)
  const data = await pool.getPoolData(provider)

  // reserve0 belongs to token0 (offer), reserve1 belongs to token1 (ask)
  const reserveIn = data.reserve0
  const reserveOut = data.reserve1

  // Total fee in basis points (STON.fi CPI pool: lpFee + protocolFee ≈ 30 bps)
  const feeBps = Number(data.lpFee) + Number(data.protocolFee)

  // Constant product formula with fee
  const amountInWithFee = offerRaw * BigInt(10000 - feeBps) / 10000n
  const newReserveIn = reserveIn + amountInWithFee
  const expectedOut = reserveOut - (reserveIn * reserveOut) / newReserveIn

  return formatTokenAmount(expectedOut, askDecimals)
}
