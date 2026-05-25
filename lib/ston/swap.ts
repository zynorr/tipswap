/**
 * @file STON.fi DEX integration — swap construction, gas estimation, and routing.
 *
 * Flow:
 *   1. Resolve token addresses (mainnet minter addresses)
 *   2. Preflight: check the wallet has enough TON for swap amount + gas + buffer
 *   3. Ask STON.fi's API to simulate the route, router, gas, and expected output
 *   4. Build the swap transaction with the SDK router selected by that simulation
 *   5. Broadcast and confirm (seqno polling)
 *
 * STON.fi may route different pairs through different router versions. The API
 * simulation is the source of truth for router/pTON selection and min ask amount.
 */
import "server-only"
import { Address, toNano, type Cell } from "@ton/core"
import type { SenderArguments } from "@ton/ton"
import { StonApiClient, type SwapSimulation } from "@ston-fi/api"
import { dexFactory, routerFactory } from "@ston-fi/sdk"
import {
  getBalance,
  getJettonBalance,
  getNetwork,
  getTonClient,
  sendInternalMessage,
  sendTonTransfer,
} from "@/lib/wallet/ton"

const TON_ASSET_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"
type SwapRouter = {
  getSwapTonToJettonTxParams(
    params: Record<string, unknown>,
  ): Promise<SenderArguments & { to: Address; value: bigint; body?: Cell | null }>
  getSwapJettonToTonTxParams(
    params: Record<string, unknown>,
  ): Promise<SenderArguments & { to: Address; value: bigint; body?: Cell | null }>
  getSwapJettonToJettonTxParams(
    params: Record<string, unknown>,
  ): Promise<SenderArguments & { to: Address; value: bigint; body?: Cell | null }>
}

export class SwapUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SwapUserError"
  }
}

/** Common jetton minter addresses keyed by symbol. */
export const TOKENS: Record<string, { mainnet: string; decimals: number }> = {
  TON: { mainnet: TON_ASSET_ADDRESS, decimals: 9 },
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
  /** Optional minimum ask amount (raw units). If omitted, it is computed from the quote and slippageBps. */
  minAskAmount?: bigint
}

export type TipQuoteParams = {
  /** Symbol of token the sender pays with */
  offer: string
  /** Symbol of token the recipient receives */
  ask: string
  /** Human-readable amount the recipient should receive */
  askAmount: string
  /** Slippage in basis points. 100 = 1% */
  slippageBps?: number
}

export type TipSwapParams = TipQuoteParams & {
  /** Sender's wallet mnemonic (decrypted, in memory only) */
  mnemonic: string
  /** Sender's TON wallet address */
  senderAddress: string
  /** Recipient's active TON wallet address */
  recipientAddress: string
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

export function applySlippage(rawAmount: bigint, slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) {
    throw new SwapUserError("Slippage must be between 0 and 5000 basis points.")
  }
  return (rawAmount * BigInt(10_000 - slippageBps)) / 10_000n
}

export function slippageBpsToTolerance(slippageBps: number) {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000) {
    throw new SwapUserError("Slippage must be between 0 and 5000 basis points.")
  }
  return (slippageBps / 10_000).toString()
}

function tokenAddress(symbol: string) {
  return TOKENS[symbol].mainnet
}

function createSwapRouter(
  client: ReturnType<typeof getTonClient>,
  simulation: SwapSimulation,
) {
  const router = client.open(routerFactory(simulation.router)) as unknown as SwapRouter
  const { pTON: Pton } = dexFactory(simulation.router)
  const proxyTon = Pton.create(simulation.router.ptonMasterAddress)
  return { router, proxyTon }
}

async function buildSwapTxParams(params: {
  router: SwapRouter
  proxyTon: ReturnType<ReturnType<typeof dexFactory>["pTON"]["create"]>
  simulation: SwapSimulation
  userAddress: string
  receiverAddress?: string
  offerSymbol: string
  askSymbol: string
  offerAddress: string
  askAddress: string
  offerAmount: bigint
  minAskAmount: bigint
}): Promise<SenderArguments & { to: Address; value: bigint; body?: Cell | null }> {
  const {
    router,
    proxyTon,
    simulation,
    userAddress,
    receiverAddress,
    offerSymbol,
    askSymbol,
    offerAddress,
    askAddress,
    offerAmount,
    minAskAmount,
  } = params

  if (offerSymbol === "TON" && askSymbol !== "TON") {
    return await router.getSwapTonToJettonTxParams({
      userWalletAddress: userAddress,
      proxyTon,
      askJettonAddress: askAddress,
      askJettonWalletAddress: simulation.askJettonWallet,
      offerJettonWalletAddress: simulation.offerJettonWallet,
      offerAmount,
      minAskAmount,
      forwardGasAmount: simulation.gasParams.forwardGas,
      ...(receiverAddress ? { receiverAddress } : {}),
    })
  }
  if (offerSymbol !== "TON" && askSymbol === "TON") {
    return await router.getSwapJettonToTonTxParams({
      userWalletAddress: userAddress,
      proxyTon,
      offerJettonAddress: offerAddress,
      offerJettonWalletAddress: simulation.offerJettonWallet,
      askJettonWalletAddress: simulation.askJettonWallet,
      offerAmount,
      minAskAmount,
      gasAmount: simulation.gasParams.gasBudget,
      forwardGasAmount: simulation.gasParams.forwardGas,
      ...(receiverAddress ? { receiverAddress } : {}),
    })
  }
  return await router.getSwapJettonToJettonTxParams({
    userWalletAddress: userAddress,
    offerJettonAddress: offerAddress,
    askJettonAddress: askAddress,
    offerJettonWalletAddress: simulation.offerJettonWallet,
    askJettonWalletAddress: simulation.askJettonWallet,
    offerAmount,
    minAskAmount,
    gasAmount: simulation.gasParams.gasBudget,
    forwardGasAmount: simulation.gasParams.forwardGas,
    ...(receiverAddress ? { receiverAddress } : {}),
  })
}

function parsePositiveAmount(amount: string, decimals: number, label: string) {
  if (!/^\d+(\.\d+)?$/.test(amount)) {
    throw new SwapUserError(`${label} amount must be a number.`)
  }
  const raw = toRawAmount(amount, decimals)
  if (raw <= 0n) {
    throw new SwapUserError(`${label} amount must be greater than zero.`)
  }
  return raw
}

function maxBigint(values: bigint[]) {
  return values.reduce((max, value) => (value > max ? value : max), 0n)
}

function requiredTonForSimulation(
  simulation: SwapSimulation,
  offerSymbol: string,
  askSymbol: string,
  offerRaw: bigint,
) {
  const fallback = requiredTonForSwap(offerSymbol, askSymbol, offerRaw)
  const gasValues = [
    fallback.gas,
    simulation.gasParams.gasBudget ? BigInt(simulation.gasParams.gasBudget) : 0n,
    simulation.gasParams.forwardGas ? BigInt(simulation.gasParams.forwardGas) : 0n,
  ]
  const gas = maxBigint(gasValues)
  const buffer = toNano("0.05")
  const offerPart = offerSymbol === "TON" ? offerRaw : 0n
  return { offerPart, gas, buffer, total: offerPart + gas + buffer }
}

function ensureV2DirectSwap(simulation: SwapSimulation) {
  if (simulation.router.majorVersion !== 2) {
    throw new SwapUserError(
      "Direct tipping is unavailable for this route right now. Try a different token pair.",
    )
  }
}

function tipQuoteFromSimulation(
  simulation: SwapSimulation,
  offerDecimals: number,
  askDecimals: number,
) {
  const offerRaw = BigInt(simulation.offerUnits)
  const askRaw = BigInt(simulation.askUnits)
  const minAskRaw = BigInt(
    simulation.recommendedMinAskUnits || simulation.minAskUnits,
  )

  if (offerRaw <= 0n || askRaw <= 0n || minAskRaw <= 0n) {
    throw new Error("STON.fi quote returned zero output")
  }

  return {
    offerAmount: formatTokenAmount(offerRaw, offerDecimals),
    offerRaw: offerRaw.toString(),
    expectedOut: formatTokenAmount(askRaw, askDecimals),
    expectedRaw: askRaw.toString(),
    askRaw: askRaw.toString(),
    minAskAmount: minAskRaw.toString(),
    routerVersion: `v${simulation.router.majorVersion}.${simulation.router.minorVersion}`,
  }
}

async function simulateDirectTip(params: TipQuoteParams) {
  const stonApi = new StonApiClient()
  const offer = resolveToken(params.offer)
  const ask = resolveToken(params.ask)
  const slippageBps = params.slippageBps ?? 100

  if (offer.symbol === ask.symbol) {
    throw new SwapUserError("Cannot tip by swapping a token to itself.")
  }

  const askRaw = parsePositiveAmount(params.askAmount, ask.decimals, "Tip")

  let simulation: SwapSimulation
  try {
    simulation = await stonApi.simulateReverseSwap({
      offerAddress: tokenAddress(offer.symbol),
      askAddress: tokenAddress(ask.symbol),
      askUnits: askRaw.toString(),
      slippageTolerance: slippageBpsToTolerance(slippageBps),
      dexV2: true,
      dexVersion: [2],
    })
    ensureV2DirectSwap(simulation)
  } catch (err) {
    if (err instanceof SwapUserError) throw err
    console.warn("[tipswap] reverse quote lookup failed:", (err as Error).message)
    throw new SwapUserError(
      "Could not get a live STON.fi quote for this tip route. Try again shortly or use a more liquid pair.",
    )
  }

  const quote = tipQuoteFromSimulation(
    simulation,
    offer.decimals,
    ask.decimals,
  )

  return { offer, ask, slippageBps, simulation, quote }
}

/**
 * Build and broadcast a STON.fi swap from the provided wallet.
 * Returns the seqno-confirmation result from sendInternalMessage.
 */
export async function executeSwap(params: SwapParams) {
  const network = getNetwork()
  const client = getTonClient(network)
  const stonApi = new StonApiClient()

  const offer = resolveToken(params.offer)
  const ask = resolveToken(params.ask)
  const slippageBps = params.slippageBps ?? 100

  if (offer.symbol === ask.symbol) {
    throw new SwapUserError("Cannot swap a token to itself.")
  }

  const offerRaw = parsePositiveAmount(params.offerAmount, offer.decimals, "Swap")

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

  if (offer.symbol !== "TON") {
    const offerBalance = await getJettonBalance(params.userAddress, offer.mainnet)
    if (offerBalance < offerRaw) {
      throw new SwapUserError(
        `Insufficient ${offer.symbol} balance. Need ${formatTokenAmount(offerRaw, offer.decimals)} ${offer.symbol}, wallet has ${formatTokenAmount(offerBalance, offer.decimals)} ${offer.symbol}.`,
      )
    }
  }

  let quote: SwapQuote
  let simulation: SwapSimulation
  try {
    simulation = await stonApi.simulateSwap({
      offerAddress: tokenAddress(offer.symbol),
      askAddress: tokenAddress(ask.symbol),
      offerUnits: offerRaw.toString(),
      slippageTolerance: slippageBpsToTolerance(slippageBps),
    })
    quote = getExpectedOutFromSimulation(simulation, ask.decimals)
  } catch (err) {
    console.warn("[tipswap] quote lookup failed:", (err as Error).message)
    throw new SwapUserError(
      "Could not get a live STON.fi quote for this route. Try again shortly or use a more liquid pair.",
    )
  }

  const minAskAmount =
    params.minAskAmount ?? BigInt(simulation.recommendedMinAskUnits || simulation.minAskUnits)
  if (minAskAmount <= 0n) {
    throw new SwapUserError("Quoted output is too small after slippage. Increase the amount and try again.")
  }

  const { router, proxyTon } = createSwapRouter(client, simulation)
  const txParams: SenderArguments & { to: Address; value: bigint; body?: Cell | null } =
    await (async () => {
      try {
        return await buildSwapTxParams({
          router,
          proxyTon,
          simulation,
          userAddress: params.userAddress,
          offerSymbol: offer.symbol,
          askSymbol: ask.symbol,
          offerAddress: offer.mainnet,
          askAddress: ask.mainnet,
          offerAmount: offerRaw,
          minAskAmount,
        })
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
    })()

  const result = await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: txParams.to,
    value: txParams.value,
    body: txParams.body ?? undefined,
  })

  return {
    ...result,
    expectedOut: quote.expectedOut,
    expectedRaw: quote.expectedRaw.toString(),
    minAskAmount: minAskAmount.toString(),
    offerRaw: offerRaw.toString(),
    network,
  }
}

export async function quoteTipSwap(params: TipQuoteParams) {
  const offerToken = resolveToken(params.offer)
  const askToken = resolveToken(params.ask)
  const slippageBps = params.slippageBps ?? 100
  if (offerToken.symbol === askToken.symbol) {
    if (offerToken.symbol !== "TON") {
      throw new SwapUserError(
        "Same-token jetton tips are not supported yet. Use TON or choose a different pay token.",
      )
    }
    const raw = parsePositiveAmount(params.askAmount, askToken.decimals, "Tip")
    const amount = formatTokenAmount(raw, askToken.decimals)
    return {
      offerSymbol: "TON",
      askSymbol: "TON",
      askAmount: params.askAmount,
      askRaw: raw.toString(),
      quotedOfferAmount: amount,
      offerRaw: raw.toString(),
      expectedOut: amount,
      expectedRaw: raw.toString(),
      minAskAmount: raw.toString(),
      slippageBps,
      routerVersion: "direct",
      network: getNetwork(),
    }
  }

  const simulated = await simulateDirectTip(params)
  return {
    offerSymbol: simulated.offer.symbol,
    askSymbol: simulated.ask.symbol,
    askAmount: params.askAmount,
    askRaw: simulated.quote.askRaw,
    quotedOfferAmount: simulated.quote.offerAmount,
    offerRaw: simulated.quote.offerRaw,
    expectedOut: simulated.quote.expectedOut,
    expectedRaw: simulated.quote.expectedRaw,
    minAskAmount: simulated.quote.minAskAmount,
    slippageBps: simulated.slippageBps,
    routerVersion: simulated.quote.routerVersion,
    network: getNetwork(),
  }
}

export async function executeTipSwap(params: TipSwapParams) {
  try {
    Address.parse(params.recipientAddress)
  } catch {
    throw new SwapUserError("Recipient wallet address is invalid.")
  }

  const offerToken = resolveToken(params.offer)
  const askToken = resolveToken(params.ask)
  if (offerToken.symbol === askToken.symbol) {
    if (offerToken.symbol !== "TON") {
      throw new SwapUserError(
        "Same-token jetton tips are not supported yet. Use TON or choose a different pay token.",
      )
    }
    const raw = parsePositiveAmount(params.askAmount, askToken.decimals, "Tip")
    const amount = formatTokenAmount(raw, askToken.decimals)
    const result = await sendTonTransfer({
      mnemonic: params.mnemonic,
      to: params.recipientAddress,
      amount: raw,
    })
    return {
      ...result,
      offerAmount: amount,
      offerRaw: raw.toString(),
      expectedOut: amount,
      expectedRaw: raw.toString(),
      askRaw: raw.toString(),
      minAskAmount: raw.toString(),
      slippageBps: params.slippageBps ?? 100,
      network: getNetwork(),
    }
  }

  const network = getNetwork()
  const client = getTonClient(network)
  const { offer, ask, slippageBps, simulation, quote } =
    await simulateDirectTip(params)
  const offerRaw = BigInt(quote.offerRaw)
  const minAskAmount = BigInt(quote.minAskAmount)

  const tonBalance = await getBalance(params.senderAddress)
  const cost = requiredTonForSimulation(
    simulation,
    offer.symbol,
    ask.symbol,
    offerRaw,
  )
  if (tonBalance < cost.total) {
    const lines = [
      `Insufficient TON balance. Need ${formatTon(cost.total)} TON, wallet has ${formatTon(tonBalance)} TON.`,
      "",
    ]
    if (offer.symbol === "TON") {
      lines.push(`Tip swap amount: ${formatTon(cost.offerPart)} TON`)
    }
    lines.push(`Gas (STON.fi): ${formatTon(cost.gas)} TON`)
    lines.push(`Safety buffer: ${formatTon(cost.buffer)} TON`)

    throw new SwapUserError(lines.join("\n"))
  }

  if (offer.symbol !== "TON") {
    const offerBalance = await getJettonBalance(params.senderAddress, offer.mainnet)
    if (offerBalance < offerRaw) {
      throw new SwapUserError(
        `Insufficient ${offer.symbol} balance. Need ${formatTokenAmount(offerRaw, offer.decimals)} ${offer.symbol}, wallet has ${formatTokenAmount(offerBalance, offer.decimals)} ${offer.symbol}.`,
      )
    }
  }

  const { router, proxyTon } = createSwapRouter(client, simulation)
  const txParams: SenderArguments & { to: Address; value: bigint; body?: Cell | null } =
    await (async () => {
      try {
        return await buildSwapTxParams({
          router,
          proxyTon,
          simulation,
          userAddress: params.senderAddress,
          receiverAddress: params.recipientAddress,
          offerSymbol: offer.symbol,
          askSymbol: ask.symbol,
          offerAddress: offer.mainnet,
          askAddress: ask.mainnet,
          offerAmount: offerRaw,
          minAskAmount,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (
          message.toLowerCase().includes("insufficient") ||
          message.toLowerCase().includes("not enough") ||
          message.toLowerCase().includes("low balance")
        ) {
          throw new SwapUserError(
            "Insufficient balance for this tip swap. Top up wallet and try a smaller amount.",
          )
        }
        if (message.includes("status code 500")) {
          throw new SwapUserError(
            "Tip route unavailable right now. Try TON/USDT or TON/STON, reduce amount, and retry in 20-30s.",
          )
        }
        throw err
      }
    })()

  const result = await sendInternalMessage({
    mnemonic: params.mnemonic,
    to: txParams.to,
    value: txParams.value,
    body: txParams.body ?? undefined,
  })

  return {
    ...result,
    offerAmount: quote.offerAmount,
    offerRaw: quote.offerRaw,
    expectedOut: quote.expectedOut,
    expectedRaw: quote.expectedRaw,
    askRaw: quote.askRaw,
    minAskAmount: quote.minAskAmount,
    slippageBps,
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

export type SwapQuote = {
  expectedOut: string
  expectedRaw: bigint
}

export function getExpectedOutFromSimulation(
  simulation: Pick<SwapSimulation, "askUnits">,
  askDecimals: number,
): SwapQuote {
  const expectedRaw = BigInt(simulation.askUnits)
  if (expectedRaw <= 0n) {
    throw new Error("STON.fi quote returned zero output")
  }

  return {
    expectedOut: formatTokenAmount(expectedRaw, askDecimals),
    expectedRaw,
  }
}
