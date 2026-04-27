/**
 * Probe a real STON.fi mainnet quote via the public API.
 * Useful as a manual smoke test for the quote helper.
 *
 * Run: node scripts/probe-quote.mjs
 */

const TOKENS = {
  TON: "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c", // canonical zero address
  USDT: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  STON: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO",
  NOT: "EQAvlWFDxGF2lXm67y4yzC17wYKD9A0guwPkMs1gOsM__NOT",
}

async function probe(offer, ask, units) {
  const u = new URL("https://api.ston.fi/v1/swap/simulate")
  u.searchParams.set("offer_address", offer)
  u.searchParams.set("ask_address", ask)
  u.searchParams.set("units", units)
  u.searchParams.set("slippage_tolerance", "0.01")
  u.searchParams.set("dex_v2", "true")

  const res = await fetch(u, { method: "POST", headers: { accept: "application/json" } })
  const text = await res.text()
  if (!res.ok) {
    console.log(`FAIL  ${offer.slice(0, 8)}->${ask.slice(0, 8)}: HTTP ${res.status} ${text.slice(0, 200)}`)
    return
  }
  const j = JSON.parse(text)
  console.log(
    `OK    ${offer.slice(0, 8)}->${ask.slice(0, 8)}: ` +
      `dex=${j.dex_version || "?"} ` +
      `router=${(j.router_address || "").slice(0, 12)}... ` +
      `min_ask=${j.min_ask_units} ` +
      `slippage=${j.slippage_tolerance}`,
  )
}

console.log("Probing STON.fi mainnet quotes...")
await probe(TOKENS.TON, TOKENS.USDT, "1000000000") // 1 TON -> USDT
await probe(TOKENS.USDT, TOKENS.TON, "1000000") // 1 USDT -> TON
await probe(TOKENS.TON, TOKENS.STON, "1000000000") // 1 TON -> STON
await probe(TOKENS.USDT, TOKENS.STON, "1000000") // 1 USDT -> STON
