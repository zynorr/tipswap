import "server-only"
import { Address, type Cell, toNano } from "@ton/core"
import { pTON } from "@ston-fi/sdk"
import { DEX as DEX_V1 } from "@ston-fi/sdk/dex/v1"
import { CPIRouterV2_2 } from "@ston-fi/sdk/dex/v2_2"
import {
  getTonClient,
  getNetwork,
  sendInternalMessage,
} from "@/lib/wallet/ton"
import { simulateSwap, formatUnits, TON_SENTINEL, QuoteError } from "./quote"

export class SwapNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SwapNetworkError"
  }
}

export class InsufficientFundsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InsufficientFundsError"
  }
}

/**
 * Token registry. Addresses are STON.fi-canonical mainnet jetton masters.
 * Use TON_SENTINEL for native TON when calling the simulate API.
 */
export const TOKENS: Record<string, { address: string; decimals: number; display: string }> = {
  TON: {
    address: TON_SENTINEL,
    decimals: 9,
    display: "TON",
  },
  USDT: {
    address: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
    decimals: 6,
    display: "USDT",
  },
  STON: {
    address: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO",
    decimals: 9,
    display: "STON",
  },
  NOT: {
    address: "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
    decimals: 9,
    display: "NOT",
  },
  DOGS: {
    address: "EQCvxJy4eG8hyHBFsZ7eePxrRsUQSFE_jpptRAYBmcG_DOGS",
    decimals: 9,
    display: "DOGS",
  },
}

export type Token = (typeof TOKENS)[string] & { symbol: string }

export function resolveToken(symbol: string): Token {
  const upper = symbol.toUpperCase()
  const entry = TOKENS[upper]
  if (!entry) {
    throw new Error(
      `Unknown token: ${symbol}. Supported: ${Object.keys(TOKENS).join(", ")}`,
    )
  }
  return { symbol: upper, ...entry }
}

function toRawAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ""] = amount.split(".")
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals)
  return BigInt(whole + padded)
}

/**
 * Quote a swap. Returns a structured result the bot can format to the user.
 * Calls STON.fi's REST simulate endpoint, no on-chain calls.
 */
export async function quoteSwap(args: {
  offer: string
  ask: string
  offerAmount: string
  slippageBps?: number
}) {
  if (getNetwork() !== "mainnet") {
    throw new SwapNetworkError(
      "STON.fi DEX is mainnet-only. Set STON_NETWORK=mainnet on the server to enable swaps.",
    )
  }

  const offer = resolveToken(args.offer)
  const ask = resolveToken(args.ask)
  if (offer.symbol === ask.symbol) {
    throw new Error("Cannot swap a token to itself")
  }

  const offerUnits = toRawAmount(args.offerAmount, offer.decimals)
  const slippageBps = args.slippageBps ?? 100

  const sim = await simulateSwap({
    offerAddress: offer.address,
    askAddress: ask.address,
    offerUnits,
    slippageBps,
  })

  return {
    offer,
    ask,
    offerAmount: args.offerAmount,
    offerUnits,
    askUnits: BigInt(sim.askUnits),
    minAskUnits: BigInt(sim.minAskUnits),
    askFormatted: formatUnits(sim.askUnits, ask.decimals),
    minAskFormatted: formatUnits(sim.minAskUnits, ask.decimals),
    swapRate: sim.swapRate,
    priceImpact: sim.priceImpact,
    feePercent: sim.feePercent,
    routerAddress: sim.routerAddress,
    ptonMasterAddress: sim.ptonMasterAddress,
    ptonVersion: sim.ptonVersion,
    slippageBps,
  }
}

export type SwapQuote = Awaited<ReturnType<typeof quoteSwap>>

export type SwapParams = {
  /** Decrypted sender mnemonic, in memory only */
  mnemonic: string
  /** Sender's TON wallet address */
  userAddress: string
  /** Pre-computed quote from `quoteSwap`. Required so we don't double-quote. */
  quote: SwapQuote
}

/** TON to attach to the outer wallet message. Covers swap forward gas + execution. */
function gasForOffer(symbol: string): bigint {
  return symbol === "TON" ? toNano("0.25") : toNano("0.3")
}

/**
 * Build and broadcast a STON.fi swap using the router/pton returned by the
 * simulate quote. Picks the right Router class based on `quote.ptonVersion`.
 */
export async function executeSwap(params: SwapParams): Promise<{
  sent: boolean
  seqno: number
  network: "mainnet" | "testnet"
  expectedOut: string
  minOut: string
}> {
  if (getNetwork() !== "mainnet") {
    throw new SwapNetworkError(
      "STON.fi DEX is mainnet-only. Set STON_NETWORK=mainnet on the server to enable swaps.",
    )
  }

  const { quote } = params
  const client = getTonClient("mainnet")

  const txParams = await buildSwapTx({
    client,
    quote,
    userAddress: params.userAddress,
  })

  const result = await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: txParams.to,
    value: txParams.value,
    body: txParams.body,
  })

  return {
    sent: result.sent,
    seqno: result.seqno,
    network: "mainnet",
    expectedOut: quote.askFormatted,
    minOut: quote.minAskFormatted,
  }
}

/**
 * Construct the on-chain swap message for the given quote.
 * Selects RouterV1 + pTON.v1 or CPIRouterV2_2 + pTON.v2_1 based on the
 * pton_version returned by simulate.
 */
async function buildSwapTx(args: {
  client: ReturnType<typeof getTonClient>
  quote: SwapQuote
  userAddress: string
}): Promise<{ to: Address; value: bigint; body: Cell }> {
  const { quote, client, userAddress } = args
  const { offer, ask } = quote

  const useV1 = quote.ptonVersion === "1.0" || quote.ptonVersion.startsWith("1")
  const proxyTon = useV1
    ? pTON.v1.create(Address.parse(quote.ptonMasterAddress))
    : pTON.v2_1.create(Address.parse(quote.ptonMasterAddress))

  const router = useV1
    ? client.open(DEX_V1.Router.create(Address.parse(quote.routerAddress)))
    : client.open(CPIRouterV2_2.create(Address.parse(quote.routerAddress)))

  // TON -> Jetton
  if (offer.symbol === "TON" && ask.symbol !== "TON") {
    const tx = await (router as any).getSwapTonToJettonTxParams({
      userWalletAddress: userAddress,
      proxyTon,
      askJettonAddress: ask.address,
      offerAmount: quote.offerUnits,
      minAskAmount: quote.minAskUnits,
    })
    return { to: tx.to, value: tx.value, body: tx.body }
  }

  // Jetton -> TON
  if (offer.symbol !== "TON" && ask.symbol === "TON") {
    const tx = await (router as any).getSwapJettonToTonTxParams({
      userWalletAddress: userAddress,
      proxyTon,
      offerJettonAddress: offer.address,
      offerAmount: quote.offerUnits,
      minAskAmount: quote.minAskUnits,
    })
    return { to: tx.to, value: tx.value, body: tx.body }
  }

  // Jetton -> Jetton
  const tx = await (router as any).getSwapJettonToJettonTxParams({
    userWalletAddress: userAddress,
    offerJettonAddress: offer.address,
    askJettonAddress: ask.address,
    offerAmount: quote.offerUnits,
    minAskAmount: quote.minAskUnits,
  })
  return { to: tx.to, value: tx.value, body: tx.body }
}

/**
 * Returns true if the user has enough TON to cover (offer if TON) + gas + small buffer.
 * Throws InsufficientFundsError otherwise.
 */
export function assertSufficientTon(args: {
  /** Current TON balance, in nanotons */
  balance: bigint
  /** Symbol of the offer side (TON if native, else any jetton) */
  offerSymbol: string
  /** Raw offer amount, in nanotons (only relevant when offerSymbol === "TON") */
  offerUnits: bigint
}) {
  const gas = gasForOffer(args.offerSymbol.toUpperCase())
  const buffer = toNano("0.05") // safety
  const tonNeeded =
    (args.offerSymbol.toUpperCase() === "TON" ? args.offerUnits : 0n) + gas + buffer

  if (args.balance < tonNeeded) {
    const need = formatUnits(tonNeeded, 9)
    const have = formatUnits(args.balance, 9)
    throw new InsufficientFundsError(
      `Wallet has ${have} TON but needs at least ${need} TON (swap + gas + buffer).`,
    )
  }
}

export { QuoteError }
