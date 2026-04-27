import "server-only"

/**
 * Wrapper around STON.fi's `/v1/swap/simulate` endpoint.
 *
 * The simulate endpoint is the canonical way to get a quote from STON.fi:
 * it picks the best pool across DEX versions (v1, v2_1, v2_2), returns
 * slippage-protected min_ask_units, and tells us which router and pTON
 * version to construct the on-chain swap message against.
 *
 * Docs: https://docs.ston.fi/docs/developer-section/api-reference-v1/swap
 */

const API_BASE = "https://api.ston.fi/v1"

/** The sentinel address STON.fi's REST API uses for native TON. */
export const TON_SENTINEL = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c"

export type SimulateResult = {
  offerAddress: string
  askAddress: string
  /** Address of the STON.fi router that holds the deepest pool for this pair. */
  routerAddress: string
  /** pTON proxy contract used by that router (v1 or v2_1). */
  ptonMasterAddress: string
  /** "1.0" or "2.1". Determines which Router class to instantiate. */
  ptonVersion: string
  /** "ConstantProduct" or "Stable". Constant Product covers all v1 + most v2.x pools. */
  routerType: string
  /** Pool address (informational). */
  poolAddress: string
  /** Raw offer amount that was simulated (echoed back). */
  offerUnits: string
  /** Expected output, no slippage applied. */
  askUnits: string
  /** Slippage-protected minimum the bot should pass as `minAskAmount`. */
  minAskUnits: string
  /** Slippage actually applied (echoed back, e.g. "0.01"). */
  slippageTolerance: string
  /** STON.fi's recommended slippage if ours was too tight. */
  recommendedSlippageTolerance: string
  /** STON.fi's recommended min if ours was too tight. */
  recommendedMinAskUnits: string
  /** Effective rate (ask / offer in human decimals). */
  swapRate: string
  /** Estimated price impact (e.g. "0.000000363"). */
  priceImpact: string
  /** Fee details for display. */
  feeUnits: string
  feePercent: string
  /** Recommended forward + execution gas (raw nanotons). */
  forwardGas: string
  estimatedGasConsumption: string
}

export class QuoteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly raw?: unknown,
  ) {
    super(message)
    this.name = "QuoteError"
  }
}

/**
 * Ask STON.fi to simulate a swap and return everything we need to execute it.
 *
 * @param offerAddress  Jetton master address of the token being sold (use TON_SENTINEL for TON)
 * @param askAddress    Jetton master address of the token being bought
 * @param offerUnits    Raw offer amount (already in jetton base units, e.g. nanotons for TON)
 * @param slippageBps   Slippage tolerance in basis points (100 = 1%)
 */
export async function simulateSwap(params: {
  offerAddress: string
  askAddress: string
  offerUnits: bigint
  slippageBps: number
  referralAddress?: string
}): Promise<SimulateResult> {
  const tolerance = (params.slippageBps / 10_000).toString()
  const qs = new URLSearchParams({
    offer_address: params.offerAddress,
    ask_address: params.askAddress,
    units: params.offerUnits.toString(),
    slippage_tolerance: tolerance,
  })
  if (params.referralAddress) {
    qs.set("referral_address", params.referralAddress)
  }

  const url = `${API_BASE}/swap/simulate?${qs.toString()}`
  const res = await fetch(url, {
    method: "POST",
    headers: { accept: "application/json" },
    cache: "no-store",
  })

  const text = await res.text()
  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    throw new QuoteError(
      `STON.fi simulate returned non-JSON: ${text.slice(0, 200)}`,
      res.status,
      text,
    )
  }

  if (!res.ok) {
    const reason =
      body?.message ||
      body?.error ||
      (typeof body === "string" ? body : JSON.stringify(body).slice(0, 200))
    throw new QuoteError(`STON.fi simulate failed: ${reason}`, res.status, body)
  }

  return {
    offerAddress: body.offer_address,
    askAddress: body.ask_address,
    routerAddress: body.router_address,
    ptonMasterAddress: body.router?.pton_master_address,
    ptonVersion: body.router?.pton_version ?? "1.0",
    routerType: body.router?.router_type ?? "ConstantProduct",
    poolAddress: body.pool_address,
    offerUnits: body.offer_units,
    askUnits: body.ask_units,
    minAskUnits: body.min_ask_units,
    slippageTolerance: body.slippage_tolerance,
    recommendedSlippageTolerance: body.recommended_slippage_tolerance,
    recommendedMinAskUnits: body.recommended_min_ask_units,
    swapRate: body.swap_rate,
    priceImpact: body.price_impact,
    feeUnits: body.fee_units,
    feePercent: body.fee_percent,
    forwardGas: body.gas_params?.forward_gas ?? "0",
    estimatedGasConsumption: body.gas_params?.estimated_gas_consumption ?? "0",
  }
}

/** Convert raw jetton units to a human-readable decimal string. */
export function formatUnits(raw: string | bigint, decimals: number): string {
  const big = typeof raw === "bigint" ? raw : BigInt(raw)
  const negative = big < 0n
  const abs = negative ? -big : big
  const s = abs.toString().padStart(decimals + 1, "0")
  const intPart = s.slice(0, s.length - decimals) || "0"
  const fracPart = s.slice(s.length - decimals).replace(/0+$/, "")
  const out = fracPart ? `${intPart}.${fracPart}` : intPart
  return negative ? `-${out}` : out
}
