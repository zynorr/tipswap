import { describe, it, expect, vi, beforeEach } from "vitest"
import { Address, toNano, beginCell } from "@ton/core"

// ---- Mock dependencies before any imports ----

vi.mock("@/lib/wallet/ton", () => ({
  getBalance: vi.fn(),
  getTonClient: vi.fn(),
  getNetwork: vi.fn(() => "mainnet"),
  getNetworkDisplay: vi.fn(() => "TON Mainnet"),
  sendInternalMessage: vi.fn(),
}))

// We need a mock CPIRouterV2_2 that returns tx params and pool data
const mockGetPool = vi.fn()
const mockGetPoolData = vi.fn()
const mockGetSwapTonToJettonTxParams = vi.fn()
const mockGetSwapJettonToTonTxParams = vi.fn()
const mockGetSwapJettonToJettonTxParams = vi.fn()

vi.mock("@ston-fi/sdk/dex/v2_2", () => ({
  CPIRouterV2_2: {
    create: vi.fn(() => ({
      getPool: mockGetPool,
      getSwapTonToJettonTxParams: mockGetSwapTonToJettonTxParams,
      getSwapJettonToTonTxParams: mockGetSwapJettonToTonTxParams,
      getSwapJettonToJettonTxParams: mockGetSwapJettonToJettonTxParams,
    })),
  },
}))

vi.mock("@ston-fi/sdk", () => ({
  pTON: {
    v2_1: {
      create: vi.fn(() => ({})),
    },
  },
}))

// Now import the modules under test
import {
  executeSwap,
  SwapUserError,
  toRawAmount,
} from "@/lib/ston/swap"
import * as ton from "@/lib/wallet/ton"

// Use the production router address (valid checksum)
const mockAddress = Address.parse("EQD11suHkrO_1Mb5IIdYFx5ZPy38MuHoeHx6dA-QRaD8w0UJ")

beforeEach(() => {
  vi.clearAllMocks()

  // Default mock client
  ;(ton.getTonClient as ReturnType<typeof vi.fn>).mockReturnValue({
    open: (x: unknown) => x,
    provider: () => ({
      runMethod: vi.fn(),
    }),
  })

  // Default: user has 10 TON
  ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("10"))

  // Default tx params
  const defaultTxParams = {
    to: mockAddress,
    value: toNano("0.25"),
    body: beginCell().storeUint(0, 32).endCell(),
  }

  mockGetSwapTonToJettonTxParams.mockResolvedValue(defaultTxParams)
  mockGetSwapJettonToTonTxParams.mockResolvedValue(defaultTxParams)
  mockGetSwapJettonToJettonTxParams.mockResolvedValue(defaultTxParams)

  // Default: TON→USDT pool with 30 bps fee and reasonable reserves
  mockGetPool.mockResolvedValue({
    address: mockAddress,
    getPoolData: mockGetPoolData,
  })
  mockGetPoolData.mockResolvedValue({
    reserve0: toNano("1000"),   // 1000 TON in pool
    reserve1: 1_000_000_000_000n,   // 1M USDT in pool (6 decimals = 10^12 raw)
    lpFee: 25n,
    protocolFee: 5n,
  })

  // Default: successful broadcast
  ;(ton.sendInternalMessage as ReturnType<typeof vi.fn>).mockResolvedValue({
    sent: true,
    seqno: 42,
  })
})

// ─── Preflight tests ──────────────────────────────────────────────

describe("executeSwap — preflight", () => {
  it("throws SwapUserError when TON balance is insufficient", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)
  })

  it("includes required amounts in the error message for TON offers", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    try {
      await executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      })
    } catch (e) {
      const msg = (e as SwapUserError).message
      expect(msg).toContain("Insufficient TON balance")
      expect(msg).toContain("Swap amount:")
      expect(msg).toContain("Gas (STON.fi):")
      expect(msg).toContain("Safety buffer:")
    }
  })

  it("includes required amounts in the error message for Jetton offers", async () => {
    ;(ton.getBalance as ReturnType<typeof vi.fn>).mockResolvedValue(toNano("0.1"))

    try {
      await executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "USDT",
        ask: "TON",
        offerAmount: "10",
      })
    } catch (e) {
      const msg = (e as SwapUserError).message
      expect(msg).toContain("Insufficient TON balance")
      expect(msg).not.toContain("Swap amount:") // no offerPart since offer is not TON
      expect(msg).toContain("Gas (STON.fi):")
      expect(msg).toContain("Safety buffer:")
    }
  })
})

// ─── Route selection tests ────────────────────────────────────────

describe("executeSwap — route selection", () => {
  const validParams = {
    mnemonic: "abandon abandon ...",
    userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
  }

  it("calls getSwapTonToJettonTxParams for TON→Jetton", async () => {
    await executeSwap({ ...validParams, offer: "TON", ask: "USDT", offerAmount: "0.5" })
    expect(mockGetSwapTonToJettonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToJettonTxParams).not.toHaveBeenCalled()
  })

  it("calls getSwapJettonToTonTxParams for Jetton→TON", async () => {
    await executeSwap({ ...validParams, offer: "USDT", ask: "TON", offerAmount: "5" })
    expect(mockGetSwapJettonToTonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToJettonTxParams).not.toHaveBeenCalled()
  })

  it("calls getSwapJettonToJettonTxParams for Jetton→Jetton", async () => {
    await executeSwap({ ...validParams, offer: "USDT", ask: "STON", offerAmount: "5" })
    expect(mockGetSwapJettonToJettonTxParams).toHaveBeenCalledOnce()
    expect(mockGetSwapTonToJettonTxParams).not.toHaveBeenCalled()
    expect(mockGetSwapJettonToTonTxParams).not.toHaveBeenCalled()
  })
})

// ─── Success path ─────────────────────────────────────────────────

describe("executeSwap — success path", () => {
  it("returns sent=true, seqno, expectedOut, offerRaw, and network", async () => {
    const result = await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "TON",
      ask: "USDT",
      offerAmount: "0.5",
    })

    expect(result.sent).toBe(true)
    expect(result.seqno).toBe(42)
    expect(result.network).toBe("mainnet")
    expect(result.offerRaw).toBe(toRawAmount("0.5", 9).toString())
    // expectedOut is computed from mocked pool reserves, so we check it's a string
    expect(typeof result.expectedOut).toBe("string")
    // The swap broadcasts after getting the quote
    expect(ton.sendInternalMessage).toHaveBeenCalledOnce()
  })

  it("broadcasts the transaction after building params", async () => {
    const result = await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "STON",
      ask: "USDT",
      offerAmount: "10",
    })

    expect(result.sent).toBe(true)
    // Should have called the correct route builder
    expect(mockGetSwapJettonToJettonTxParams).toHaveBeenCalledOnce()
    // sendInternalMessage should receive to, value, body, and mnemonic
    const sentCall = (ton.sendInternalMessage as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(sentCall).toHaveProperty("mnemonic")
    expect(sentCall).toHaveProperty("to")
    expect(sentCall).toHaveProperty("value")
    expect(sentCall).toHaveProperty("body")
  })
})

// ─── getExpectedOut quote ─────────────────────────────────────────

describe("executeSwap — quote (getExpectedOut)", () => {
  it("returns null for expectedOut when RPC fails gracefully", async () => {
    mockGetPool.mockRejectedValue(new Error("TON RPC: status code 500"))

    const result = await executeSwap({
      mnemonic: "abandon abandon ...",
      userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
      offer: "TON",
      ask: "USDT",
      offerAmount: "0.5",
    })

    // Swap itself should still succeed
    expect(result.sent).toBe(true)
    expect(result.expectedOut).toBeNull()
  })
})

// ─── Swap error handling ──────────────────────────────────────────

describe("executeSwap — error handling", () => {
  it("wraps insufficient balance errors from STON.fi SDK as SwapUserError", async () => {
    mockGetSwapTonToJettonTxParams.mockRejectedValue(
      new Error("insufficient TON balance"),
    )

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow(SwapUserError)
  })

  it("re-throws unexpected errors from STON.fi SDK as-is", async () => {
    mockGetSwapTonToJettonTxParams.mockRejectedValue(
      new Error("some unexpected SDK error"),
    )

    await expect(
      executeSwap({
        mnemonic: "abandon abandon ...",
        userAddress: "0QAs9VlT6SJ7i5F7SzC8eEiGm3e7XyZ0zX9hT1G3aB8kF6rL",
        offer: "TON",
        ask: "USDT",
        offerAmount: "0.5",
      }),
    ).rejects.toThrow("some unexpected SDK error")
  })
})
