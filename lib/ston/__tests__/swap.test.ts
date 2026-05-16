import { describe, it, expect } from "vitest"
import {
  resolveToken,
  toRawAmount,
  requiredTonForSwap,
  formatTon,
  formatTokenAmount,
  estimateGasTon,
  TOKENS,
} from "@/lib/ston/swap"

// ─── resolveToken ──────────────────────────────────────────────────

describe("resolveToken", () => {
  it("resolves TON with 9 decimals", () => {
    const t = resolveToken("TON")
    expect(t.symbol).toBe("TON")
    expect(t.decimals).toBe(9)
    expect(t.mainnet).toBe("TON")
  })

  it("resolves USDT with 6 decimals", () => {
    const t = resolveToken("USDT")
    expect(t.symbol).toBe("USDT")
    expect(t.decimals).toBe(6)
    expect(t.mainnet).toMatch(/^EQC/)
  })

  it("resolves STON with 9 decimals", () => {
    const t = resolveToken("STON")
    expect(t.symbol).toBe("STON")
    expect(t.decimals).toBe(9)
    expect(t.mainnet).toMatch(/^EQA/)
  })

  it("is case-insensitive", () => {
    expect(resolveToken("ton").symbol).toBe("TON")
    expect(resolveToken("Ton").symbol).toBe("TON")
    expect(resolveToken("usdt").symbol).toBe("USDT")
    expect(resolveToken("Usdt").symbol).toBe("USDT")
  })

  it("throws for unknown token symbols", () => {
    expect(() => resolveToken("ETH")).toThrow(/Unknown token/)
    expect(() => resolveToken("BTC")).toThrow(/Unknown token/)
    expect(() => resolveToken("NOT")).toThrow(/Unknown token/) // removed from TOKENS
  })

  it("error message lists supported tokens", () => {
    try {
      resolveToken("XRP")
    } catch (e) {
      const msg = (e as Error).message
      // Should reference at least TON, USDT, STON
      expect(msg).toContain("TON")
      expect(msg).toContain("USDT")
      expect(msg).toContain("STON")
    }
  })

  it("returned entry has exact same shape for every token", () => {
    for (const symbol of Object.keys(TOKENS)) {
      const t = resolveToken(symbol)
      expect(t).toHaveProperty("symbol")
      expect(t).toHaveProperty("mainnet")
      expect(t).toHaveProperty("decimals")
      expect(typeof t.symbol).toBe("string")
      expect(typeof t.mainnet).toBe("string")
      expect(typeof t.decimals).toBe("number")
    }
  })
})

// ─── toRawAmount ───────────────────────────────────────────────────

describe("toRawAmount", () => {
  it("converts integer to raw with 9 decimals", () => {
    expect(toRawAmount("1", 9)).toBe(1_000_000_000n)
  })

  it("converts fractional to raw with 9 decimals", () => {
    expect(toRawAmount("0.5", 9)).toBe(500_000_000n)
  })

  it("converts fractional to raw with 6 decimals", () => {
    expect(toRawAmount("1.5", 6)).toBe(1_500_000n)
  })

  it("truncates extra decimals (no rounding)", () => {
    expect(toRawAmount("1.123456789", 6)).toBe(1_123_456n)
  })

  it("handles zero", () => {
    expect(toRawAmount("0", 9)).toBe(0n)
  })

  it("handles large amounts", () => {
    expect(toRawAmount("1000000", 9)).toBe(1_000_000_000_000_000n)
  })
})

// ─── requiredTonForSwap ────────────────────────────────────────────

describe("requiredTonForSwap", () => {
  it("TON→Jetton requires offer + 0.2 gas + 0.05 buffer", () => {
    const offerRaw = toRawAmount("0.5", 9) // 0.5 TON
    const cost = requiredTonForSwap("TON", "USDT", offerRaw)
    expect(cost.offerPart).toBe(offerRaw)
    expect(cost.gas).toBe(200_000_000n) // 0.2 TON
    expect(cost.buffer).toBe(50_000_000n) // 0.05 TON
    expect(cost.total).toBe(offerRaw + 200_000_000n + 50_000_000n)
  })

  it("Jetton→TON requires 0.2 gas + 0.05 buffer (no offerPart)", () => {
    const cost = requiredTonForSwap("USDT", "TON", toRawAmount("10", 6))
    expect(cost.offerPart).toBe(0n)
    expect(cost.gas).toBe(200_000_000n)
    expect(cost.total).toBe(250_000_000n)
  })

  it("Jetton→Jetton requires 0.3 gas + 0.05 buffer", () => {
    const cost = requiredTonForSwap("USDT", "STON", toRawAmount("5", 6))
    expect(cost.gas).toBe(300_000_000n)
    expect(cost.buffer).toBe(50_000_000n)
    expect(cost.total).toBe(350_000_000n)
  })
})

// ─── formatTon ─────────────────────────────────────────────────────

describe("formatTon", () => {
  it("formats whole TON", () => {
    expect(formatTon(1_000_000_000n)).toBe("1.0000")
  })

  it("formats fractional TON", () => {
    expect(formatTon(123_456_789n)).toBe("0.1234")
  })

  it("formats zero", () => {
    expect(formatTon(0n)).toBe("0.0000")
  })

  it("formats large amount", () => {
    expect(formatTon(5_123_456_789n)).toBe("5.1234")
  })
})

// ─── formatTokenAmount ─────────────────────────────────────────────

describe("formatTokenAmount", () => {
  it("formats USDT (6 decimals) with fractional part", () => {
    expect(formatTokenAmount(1_500_000n, 6)).toBe("1.5000")
  })

  it("formats TON (9 decimals) with fractional part", () => {
    expect(formatTokenAmount(500_000_000n, 9)).toBe("0.5000")
  })

  it("truncates to 4 fractional digits", () => {
    expect(formatTokenAmount(1_234_567n, 6)).toBe("1.2345")
  })

  it("handles zero", () => {
    expect(formatTokenAmount(0n, 6)).toBe("0.0000")
  })
})

// ─── estimateGasTon ────────────────────────────────────────────────

describe("estimateGasTon", () => {
  it("TON→Jetton returns 0.2", () => {
    expect(estimateGasTon("TON", "USDT")).toBe(0.2)
  })

  it("Jetton→TON returns 0.2", () => {
    expect(estimateGasTon("USDT", "TON")).toBe(0.2)
  })

  it("Jetton→Jetton returns 0.3", () => {
    expect(estimateGasTon("USDT", "STON")).toBe(0.3)
  })

  it("is case-insensitive", () => {
    expect(estimateGasTon("ton", "usdt")).toBe(0.2)
    expect(estimateGasTon("usdt", "ston")).toBe(0.3)
  })
})
