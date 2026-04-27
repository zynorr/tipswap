import "server-only"
import { Address, toNano } from "@ton/core"
import { pTON } from "@ston-fi/sdk"
import { CPIRouterV2_2 } from "@ston-fi/sdk/dex/v2_2"
import { getTonClient, getNetwork, sendInternalMessage } from "@/lib/wallet/ton"

/**
 * STON.fi DEX v2.2 contract addresses.
 *
 * Mainnet addresses are official (https://docs.ston.fi).
 * STON.fi pools used by this bot are mainnet-only.
 */
const ADDRESSES = {
  mainnet: {
    router: "EQBcbaDFLnQs0RaB9Aft7njJpHfXynjzo3jOoAm5IBYKYukn",
    pton: "EQBnGWMCf3-FZZq1W4IWcWiGAc3PHuZ0_H-7sad2oY00o83S",
  },
} as const

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
  NOT: {
    mainnet: "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
    decimals: 9,
  },
}

export function resolveToken(symbol: string) {
  const upper = symbol.toUpperCase()
  const entry = TOKENS[upper]
  if (!entry) throw new Error(`Unknown token: ${symbol}`)
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

function toRawAmount(amount: string, decimals: number) {
  const [whole, frac = ""] = amount.split(".")
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(whole + padded)
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

  let txParams: { to: Address; value: bigint; body: import("@ton/core").Cell }

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

  const result = await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: txParams.to,
    value: txParams.value,
    body: txParams.body,
  })

  return {
    ...result,
    expectedOut: minAskAmount.toString(),
    offerRaw: offerRaw.toString(),
    network,
  }
}

/**
 * Estimate gas-only TON cost for a swap (rough). Used for confirmation messages.
 * STON.fi recommends ~0.3 TON for jetton swaps.
 */
export function estimateGasTon(offerSymbol: string) {
  return offerSymbol.toUpperCase() === "TON" ? 0.25 : 0.3
}

export const SWAP_NETWORK = getNetwork
export const SWAP_GAS_BUFFER = toNano("0.3")
